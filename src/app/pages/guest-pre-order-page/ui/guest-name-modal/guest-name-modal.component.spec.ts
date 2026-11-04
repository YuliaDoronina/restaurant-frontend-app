import { TestBed } from '@angular/core/testing';
import { GuestNameModalComponent } from './guest-name-modal.component';

describe('GuestNameModalComponent', () => {
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
