import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CardReservationComponent } from './card-reservation.component';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { ReservationCustomer, ReservationStatusCustomer } from '@app/models/reservations/reservation.model';

const RESERVATION: ReservationCustomer = {
  id: 'res-1',
  tableId: 'table-1',
  startTime: new Date('2026-10-21T16:00:00Z'),
  endTime: new Date('2026-10-21T17:30:00Z'),
  guestCount: 2,
  status: ReservationStatusCustomer.Reserved,
  restaurantName: 'Green & Tasty',
  locationAddress: 'Rustaveli Avenue 48',
  waiterId: 'waiter-1',
};

describe('CardReservationComponent', () => {
  let component: CardReservationComponent;
  let fixture: ComponentFixture<CardReservationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [{ provide: API_BASE_URL, useValue: 'https://test.api' }, provideRouter([])],
      imports: [CardReservationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CardReservationComponent);
    component = fixture.componentInstance;
    // r — обов'язковий input: без нього компонент падає з NG0950
    fixture.componentRef.setInput('r', RESERVATION);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the group pre-order route from the card button', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    const groupOrderButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === 'Group Pre-Order',
    );

    expect(groupOrderButton).toBeDefined();
    groupOrderButton?.click();

    expect(navigateSpy).toHaveBeenCalledOnceWith([
      '/reservations',
      RESERVATION.id,
      'group-order',
    ]);
  });

  it('edits a reserved customer reservation when the card is clicked', () => {
    const editSpy = jasmine.createSpy('editReservation');
    component.editReservation.subscribe(editSpy);

    fixture.nativeElement.querySelector('.card').click();

    expect(editSpy).toHaveBeenCalledOnceWith(RESERVATION);
    expect(fixture.nativeElement.textContent).not.toContain('Edit');
  });

  it('cancels from the top-right button without opening edit', () => {
    const editSpy = jasmine.createSpy('editReservation');
    const cancelSpy = jasmine.createSpy('cancelReservation');
    component.editReservation.subscribe(editSpy);
    component.cancelReservation.subscribe(cancelSpy);

    fixture.nativeElement.querySelector('.cancel-icon-button').click();

    expect(cancelSpy).toHaveBeenCalledOnceWith(RESERVATION.id);
    expect(editSpy).not.toHaveBeenCalled();
  });

  it('does not open edit when a pre-order action is clicked', () => {
    const editSpy = jasmine.createSpy('editReservation');
    component.editReservation.subscribe(editSpy);

    fixture.nativeElement
      .querySelector('.customer-actions .button--primary')
      .click();

    expect(editSpy).not.toHaveBeenCalled();
  });
});
