import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GuestSessionsService } from '@app/services/guest-sessions/guest-sessions.service';
import { GuestInviteService } from '@app/services/reservation/guest-invite.service';
import { GuestPreorderStore } from './guest-preorder.store';

const INVITE: GuestInvite = {
    GroupReservationId: 'group-1',
    LocationId: 'location-1',
    RestaurantName: 'Green & Tasty',
    LocationAddress: 'Main Street 1',
    StartTime: '2026-11-03T18:00:00Z',
    EndTime: '2026-11-03T19:00:00Z',
    MaxGuestCount: 3,
    TableNumber: 4,
    InviterName: 'Alex',
};

describe('GuestPreorderStore', () => {
    let guestInviteService: jasmine.SpyObj<GuestInviteService>;
    let guestSessionsService: jasmine.SpyObj<GuestSessionsService>;

    beforeEach(() => {
        localStorage.clear();
        guestInviteService = jasmine.createSpyObj<GuestInviteService>('GuestInviteService', [
            'getInvite$',
        ]);
        guestSessionsService = jasmine.createSpyObj<GuestSessionsService>('GuestSessionsService', [
            'createSession',
            'getMenu',
            'addDish',
            'removeDish',
            'submit',
        ]);
        TestBed.configureTestingModule({
            providers: [
                { provide: GuestInviteService, useValue: guestInviteService },
                { provide: GuestSessionsService, useValue: guestSessionsService },
            ],
        });
    });

    afterEach(() => localStorage.clear());

    it('resumes a saved guest session without creating a new one', () => {
        localStorage.setItem('guestPreorder:invite-token:guestName', 'Sam');
        localStorage.setItem('guestPreorder:invite-token:guestSessionId', 'session-1');
        localStorage.setItem('guestPreorder:invite-token:guestSessionToken', 'secret-token');
        guestInviteService.getInvite$.and.returnValue(of(INVITE));
        guestSessionsService.getMenu.and.returnValue(of({ dishes: {} }));

        const store = TestBed.inject(GuestPreorderStore);
        store.initContext('invite-token');

        expect(guestInviteService.getInvite$).toHaveBeenCalledOnceWith('invite-token');
        expect(guestSessionsService.getMenu).toHaveBeenCalledOnceWith(
            'session-1',
            'secret-token'
        );
        expect(guestSessionsService.createSession).not.toHaveBeenCalled();
        expect(store.guestSessionId()).toBe('session-1');
        expect(store.guestSessionToken()).toBe('secret-token');
    });

    it('clears an old session warning when opening a different invitation', () => {
        guestInviteService.getInvite$.and.returnValue(of(INVITE));

        const store = TestBed.inject(GuestPreorderStore);
        store.sessionExpiredMessage.set('Old invitation session is inactive.');
        store.initContext('another-invite-token');

        expect(store.sessionExpiredMessage()).toBeNull();
    });

    it('shows actionable guidance when a new guest session is rejected at capacity', async () => {
        spyOn(console, 'log');
        guestSessionsService.createSession.and.returnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 400,
                        error: { errorCode: 'GuestLimitExceeded' },
                    })
            )
        );

        const store = TestBed.inject(GuestPreorderStore);
        store.invite.set(INVITE);
        await store.join('Taylor');

        expect(store.joinError()).toBe(
            'This invitation has reached its guest limit. Please ask the reservation owner to free a guest spot, then try again.'
        );
        expect(store.guestName()).toBe('');
        expect(store.guestSessionId()).toBeNull();
    });

    it('shows rejoin guidance and preserves the cart when a removed guest adds a dish', async () => {
        const existingItem = {
            dishId: 'dish-1',
            title: 'Soup',
            price: 8,
            qty: 1,
        };
        guestSessionsService.addDish.and.returnValue(
            throwError(() => new HttpErrorResponse({ status: 401 }))
        );

        const store = TestBed.inject(GuestPreorderStore);
        store.guestSessionId.set('session-1');
        store.guestSessionToken.set('session-token');
        store.cartItems.set([existingItem]);

        const added = await store.addDish({
            dishId: 'dish-2',
            title: 'Salad',
            price: 12,
        });

        expect(added).toBeFalse();
        expect(store.sessionExpiredMessage()).toContain('reopen the invitation link');
        expect(store.cartItems()).toEqual([existingItem]);
        expect(store.guestSessionId()).toBe('session-1');
        expect(store.guestSessionToken()).toBe('session-token');
        expect(store.cartError()).toBeNull();
    });

    it('keeps generic cart errors for unrelated API failures', async () => {
        guestSessionsService.addDish.and.returnValue(
            throwError(() => new HttpErrorResponse({ status: 500 }))
        );

        const store = TestBed.inject(GuestPreorderStore);
        store.guestSessionId.set('session-1');
        store.guestSessionToken.set('session-token');

        await store.addDish({
            dishId: 'dish-1',
            title: 'Soup',
            price: 8,
        });

        expect(store.sessionExpiredMessage()).toBeNull();
        expect(store.cartError()).toBe('Could not update your cart. Please try again.');
    });

    it('preserves the cart and shows rejoin guidance when submit is unauthorized', async () => {
        const existingItem = {
            dishId: 'dish-1',
            title: 'Soup',
            price: 8,
            qty: 1,
        };
        guestSessionsService.submit.and.returnValue(
            throwError(() => new HttpErrorResponse({ status: 401 }))
        );

        const store = TestBed.inject(GuestPreorderStore);
        store.guestSessionId.set('session-1');
        store.guestSessionToken.set('session-token');
        store.cartItems.set([existingItem]);

        await store.submitPreorder();

        expect(store.sessionExpiredMessage()).toContain('reopen the invitation link');
        expect(store.cartItems()).toEqual([existingItem]);
        expect(store.status()).toBe('active');
        expect(store.guestSessionId()).toBe('session-1');
        expect(store.cartError()).toBeNull();
    });
});
