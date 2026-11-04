import { TestBed } from '@angular/core/testing';
import { GuestInviteVm } from '@app/pages/guest-pre-order-page/state/guest-preorder.store';
import { GuestNameModalComponent } from './guest-name-modal.component';

const INVITE: GuestInviteVm = {
    inviterName: 'Alex',
    restaurantName: 'Green & Tasty',
    locationAddress: 'Main Street 1',
    tableNumberText: 'Table 4',
    dateText: 'Nov 04, 2026',
    timeText: '18:00 - 19:00',
    guestsText: '3 people',
};

describe('GuestNameModalComponent', () => {
    it('keeps the details area the same height when skeleton rows are replaced with details', () => {
        const fixture = TestBed.createComponent(GuestNameModalComponent);
        fixture.componentRef.setInput('inviteLoading', true);
        fixture.detectChanges();

        const loadingRows = fixture.nativeElement.querySelectorAll('.skeleton-row');
        const detailsArea = fixture.nativeElement.querySelector('.details-area') as HTMLElement;
        const loadingHeight = getComputedStyle(detailsArea).height;

        expect(loadingRows.length).toBe(5);
        expect(loadingHeight).toBe('152px');

        fixture.componentRef.setInput('inviteLoading', false);
        fixture.componentRef.setInput('invite', INVITE);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelectorAll('.details .row').length).toBe(5);
        expect(getComputedStyle(detailsArea).height).toBe(loadingHeight);
        expect(fixture.nativeElement.textContent).toContain('Green & Tasty');
    });

    it('shows retry guidance inside the invite modal and emits a retry request', () => {
        const fixture = TestBed.createComponent(GuestNameModalComponent);
        const retryRequested = jasmine.createSpy('retryRequested');
        fixture.componentInstance.retryRequested.subscribe(retryRequested);
        fixture.componentRef.setInput('inviteError', 'retryable');
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
            'Please try again.'
        );
        expect(fixture.nativeElement.querySelector('app-modal')).not.toBeNull();

        (fixture.nativeElement.querySelector('.details-error button') as HTMLButtonElement).click();

        expect(retryRequested).toHaveBeenCalled();
    });

    it('displays the guest limit error in the join dialog', () => {
        const fixture = TestBed.createComponent(GuestNameModalComponent);
        fixture.componentRef.setInput(
            'joinError',
            'This invitation has reached its guest limit.'
        );
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
            'This invitation has reached its guest limit.'
        );
    });
});
