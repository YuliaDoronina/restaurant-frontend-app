import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastService } from '../services/toast/toast.service';
import { AuthenticationService } from './services/authentication.service';
import { SKIP_ERROR_TOAST } from './skip-error-toast.context';
import { tokenInterceptor } from './token.interceptor';

const URL = 'https://test.api/reservations';

describe('tokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let toastService: jasmine.SpyObj<ToastService>;
  let authService: jasmine.SpyObj<AuthenticationService>;

  beforeEach(() => {
    toastService = jasmine.createSpyObj<ToastService>('ToastService', ['error']);
    authService = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', [
      'getTokens',
    ]);
    authService.getTokens.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastService },
        { provide: AuthenticationService, useValue: authService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows the server message in a toast for a 400 response', () => {
    http.post(URL, {}).subscribe({ error: () => undefined });

    httpMock
      .expectOne(URL)
      .flush({ message: 'Overlaps' }, { status: 400, statusText: 'Bad Request' });

    expect(toastService.error).toHaveBeenCalledWith('Overlaps', 'Error');
  });

  it('does not show a toast but still rethrows when SKIP_ERROR_TOAST is set', () => {
    let receivedStatus: number | undefined;
    http
      .post(URL, {}, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })
      .subscribe({ error: (error) => (receivedStatus = error.status) });

    httpMock
      .expectOne(URL)
      .flush({ message: 'Overlaps' }, { status: 400, statusText: 'Bad Request' });

    expect(toastService.error).not.toHaveBeenCalled();
    expect(receivedStatus).toBe(400);
  });

  it('adds the Cognito token to the owner group dish update request', () => {
    authService.getTokens.and.returnValue({ idToken: 'test-id-token', accessToken: 'test-access-token' });
    const url = 'https://test.api/guest/groups/group-1/sessions/guest-1/dishes';

    http.patch(url, { dishId: 'dish-1', quantity: 0 }).subscribe();

    const request = httpMock.expectOne(url);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-id-token');
    request.flush({});
  });

  it('leaves invalid guest cart mutation messaging to the guest page', () => {
    const url = 'https://test.api/guest/sessions/session-1/dishes';
    http.post(url, {}).subscribe({ error: () => undefined });

    httpMock
      .expectOne(url)
      .flush({ error: 'Invalid guest session token' }, { status: 401, statusText: 'Unauthorized' });

    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('leaves invalid guest submit messaging to the guest page', () => {
    const url = 'https://test.api/guest/sessions/session-1/submit';
    http.post(url, {}).subscribe({ error: () => undefined });

    httpMock
      .expectOne(url)
      .flush({ error: 'Invalid guest session token' }, { status: 401, statusText: 'Unauthorized' });

    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('keeps the session-expired toast for other guest requests', () => {
    const url = 'https://test.api/guest/sessions/session-1/menu';
    http.get(url).subscribe({ error: () => undefined });

    httpMock
      .expectOne(url)
      .flush({ error: 'Invalid guest session token' }, { status: 401, statusText: 'Unauthorized' });

    expect(toastService.error).toHaveBeenCalledWith(
      'Session expired. Please re-open the invite link.',
      'Unauthorized'
    );
  });
});
