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
});
