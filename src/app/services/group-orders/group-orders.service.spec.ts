// Рівень 2 · сервіс GroupOrdersService: URL, метод, тіло кожного запиту.
// Запуск: npm run test:hw
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SKIP_ERROR_TOAST } from '@app/auth/skip-error-toast.context';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { GroupOrdersService } from './group-orders.service';

const BASE_URL = 'https://api.test';

describe('Рівень 2 · GroupOrdersService', () => {
  let service: GroupOrdersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: BASE_URL }],
    });
    service = TestBed.inject(GroupOrdersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getGroupInvite$: loads the owner group context and reservation', () => {
    let groupId = '';
    service.getGroupInvite$('res-1').subscribe((invite) => (groupId = invite.GroupReservationId));

    http
      .expectOne(`${BASE_URL}/reservations/res-1/guest-session-id`)
      .flush({ guestSessionId: 'owner-1', groupReservationId: 'grp-1' });
    http
      .expectOne(`${BASE_URL}/reservations/res-1`)
      .flush({
        tableId: 'table-1',
        startTime: '2026-10-17T12:00:00Z',
        endTime: '2026-10-17T14:00:00Z',
        guestCount: 2,
        locationAddress: '48 Rustaveli Avenue',
        restaurantName: 'Green & Tasty',
      });

    expect(groupId).toBe('grp-1');
  });

  it('getSessions$: GET /guest/groups/{id}/sessions', () => {
    service.getSessions$('grp-1').subscribe();
    const req = http.expectOne(`${BASE_URL}/guest/groups/grp-1/sessions`);
    expect(req.request.method).toBe('GET');
    req.flush({ participants: [], total: 0 });
  });

  it('getOwnerSessionId$: повертає рядок guestSessionId', () => {
    let id = '';
    service.getOwnerSessionId$('res-1').subscribe((value) => (id = value));
    const req = http.expectOne(`${BASE_URL}/reservations/res-1/guest-session-id`);
    expect(req.request.method).toBe('GET');
    req.flush({ guestSessionId: 'owner-1' });
    expect(id).toBe('owner-1');
  });

  it('getStatus$: GET /guest/groups/{id}/status', () => {
    service.getStatus$('grp-1').subscribe();
    const req = http.expectOne(`${BASE_URL}/guest/groups/grp-1/status`);
    expect(req.request.method).toBe('GET');
    req.flush({ currentParticipants: 3, maxCapacity: 5, status: 'Open' });
  });

  it('getStatusByReservationId$: resolves the group and loads its current status', () => {
    let participants = 0;
    service
      .getStatusByReservationId$('res-1', { silent: true })
      .subscribe((status) => (participants = status.currentParticipants));

    const ownerContext = http.expectOne(`${BASE_URL}/reservations/res-1/guest-session-id`);
    expect(ownerContext.request.method).toBe('GET');
    expect(ownerContext.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    ownerContext.flush({ guestSessionId: 'owner-1', groupReservationId: 'grp-1' });

    const status = http.expectOne(`${BASE_URL}/guest/groups/grp-1/status`);
    expect(status.request.method).toBe('GET');
    expect(status.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    status.flush({ currentParticipants: 3, maxCapacity: 5, status: 'Open' });
    expect(participants).toBe(3);
  });

  it('submit$: POST /group-reservations/{id}/submit з тілом { reservationId }', () => {
    service.submit$('grp-1', 'res-1').subscribe();
    const req = http.expectOne(`${BASE_URL}/group-reservations/grp-1/submit`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reservationId: 'res-1' });
    req.flush([]);
  });

  it('updateGroupSessionDish$: PATCHes the owner group-session dish quantity', () => {
    service.updateGroupSessionDish$('grp-1', 'guest-1', 'dish-1', 2).subscribe();

    const req = http.expectOne(`${BASE_URL}/guest/groups/grp-1/sessions/guest-1/dishes`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ dishId: 'dish-1', quantity: 2 });
    req.flush({ participants: [], total: 0 });
  });
});
