import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GuestSessionsService } from '@app/services/guest-sessions/guest-sessions.service';
import { GuestInviteService } from '@app/services/reservation/guest-invite.service';
import { ToastService } from '@app/services/toast/toast.service';
import { GuestPreorderStore } from './state/guest-preorder.store';
import { GuestPreOrderPageComponent } from './guest-pre-order-page.component';

const INVITE: GuestInvite = {
  GroupReservationId: 'group-1',
  LocationId: 'location-1',
  RestaurantName: 'Green & Tasty',
  LocationAddress: 'Main Street 1',
  StartTime: '2026-11-04T18:00:00Z',
  EndTime: '2026-11-04T19:00:00Z',
  MaxGuestCount: 3,
  TableNumber: 4,
  InviterName: 'Alex',
};

describe('GuestPreOrderPageComponent', () => {
  let fixture: ComponentFixture<GuestPreOrderPageComponent>;
  let store: GuestPreorderStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [GuestPreOrderPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ token: 'invite-token' })),
          },
        },
        {
          provide: GuestInviteService,
          useValue: { getInvite$: () => of(INVITE) },
        },
        {
          provide: GuestSessionsService,
          useValue: jasmine.createSpyObj('GuestSessionsService', [
            'createSession',
            'getMenu',
            'addDish',
            'removeDish',
            'submit',
          ]),
        },
        {
          provide: ToastService,
          useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'info']),
        },
      ],
    });

    fixture = TestBed.createComponent(GuestPreOrderPageComponent);
    store = TestBed.inject(GuestPreorderStore);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('keeps Main page > Menu visible as non-clickable breadcrumb text', () => {
    const breadcrumb = fixture.nativeElement.querySelector('.page-navigation') as HTMLElement;

    expect(breadcrumb.textContent).toContain('Main page');
    expect(breadcrumb.textContent).toContain('Menu');
    expect(breadcrumb.querySelector('a')).toBeNull();
    expect([...breadcrumb.children].every((child) => child.tagName === 'SPAN')).toBeTrue();
  });

  it('opens the guest cart drawer from the shared guest cart state', () => {
    store.cartOpen.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-guest-cart-drawer .drawer')).not.toBeNull();
  });

  it('keeps invitation retry inside the guest name modal', () => {
    const reloadInvite = spyOn(store, 'loadInviteByToken').and.returnValue(Promise.resolve());
    store.inviteError.set('retryable');
    store.inviteLoading.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-guest-name-modal .details-error')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.invite-retry')).toBeNull();

    (fixture.nativeElement.querySelector('.details-error button') as HTMLButtonElement).click();

    expect(reloadInvite).toHaveBeenCalledOnceWith('invite-token');
  });

  it('shows the invalid-session guidance even when the cart drawer is closed', () => {
    store.sessionExpiredMessage.set(
      'Your guest session is no longer active. Please reopen the invitation link to rejoin the group pre-order.'
    );
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('reopen the invitation link');
    expect(fixture.nativeElement.querySelector('app-guest-cart-drawer .drawer')).toBeNull();
  });

  it('shows the submitted confirmation instead of the editable cart drawer', () => {
    store.submitSuccess();
    store.cartOpen.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-guest-preorder-submitted')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-guest-cart-drawer')).toBeNull();
  });
});
