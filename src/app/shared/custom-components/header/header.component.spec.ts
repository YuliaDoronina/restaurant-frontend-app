import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';

import { HeaderComponent } from './header.component';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { AuthenticationService } from '@app/auth/services/authentication.service';
import { NotificationsService } from '@app/services/notifications/notifications.service';
import { GuestPreorderStore } from '@app/pages/guest-pre-order-page/state/guest-preorder.store';
import { Router } from '@angular/router';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  let authMock: jasmine.SpyObj<AuthenticationService>;
  let notificationsMock: jasmine.SpyObj<NotificationsService>;

  beforeEach(async () => {
    authMock = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', ['signOut'], {
      user$: of(null),
      isAuthorised$: of(false),
    });

    notificationsMock = jasmine.createSpyObj<NotificationsService>('NotificationsService', [
      'loadNotifications',
      'markAsRead',
    ]);

    notificationsMock.loadNotifications.and.returnValue(of([]));
    notificationsMock.markAsRead.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: 'https://test.api' },
        { provide: AuthenticationService, useValue: authMock },
        { provide: NotificationsService, useValue: notificationsMock },
        provideRouter([]),
      ],
      imports: [HeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows only a static logo and guest basket on the guest pre-order route', () => {
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/join/invite-token');
    fixture.detectChanges();

    const store = TestBed.inject(GuestPreorderStore);
    const header = fixture.nativeElement as HTMLElement;

    expect(header.querySelector('.logo-container')?.tagName).toBe('DIV');
    expect(header.querySelector('.guest-cart-button')).not.toBeNull();
    expect(header.querySelector('.mobile-menu-icon')).toBeNull();
    expect(header.querySelector('nav')).toBeNull();
    expect(header.querySelector('.header-user-wrapper')).toBeNull();
    expect(header.textContent).not.toContain('Main page');
    expect(header.textContent).not.toContain('Book a Table');
    expect(header.textContent).not.toContain('Reservations');

    header.querySelector<HTMLButtonElement>('.guest-cart-button')?.click();
    expect(store.cartOpen()).toBeTrue();
  });

  it('hides the guest basket after the guest submits the pre-order', () => {
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/join/invite-token');
    TestBed.inject(GuestPreorderStore).status.set('submitted');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.guest-cart-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.logo-container')?.tagName).toBe('DIV');
  });

  it('preserves the regular header navigation outside the guest pre-order route', () => {
    const header = fixture.nativeElement as HTMLElement;

    expect(header.querySelector('.logo-container')?.tagName).toBe('A');
    expect(header.querySelector('.guest-cart-button')).toBeNull();
    expect(header.querySelector('.mobile-menu-icon')).not.toBeNull();
    expect(header.querySelector('nav')).not.toBeNull();
  });
});
