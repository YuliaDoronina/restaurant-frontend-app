import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { WritableSignal, signal } from '@angular/core';
import { NavigationEnd, Router, Event as RouterEvent } from '@angular/router';
import { Reservation, ReservationStatus } from '@app/models/reservations/reservation.model';
import { FeedbackReservationResponseItem } from '@app/models/feedbacks/feedback-reservation-response-item.model';
import { Notification } from '@app/models/notifications/notification.model';
import { AuthenticationService } from '@app/auth/services/authentication.service';
import {
  GroupOrdersService,
  ReservationGroupUpdate,
} from '@app/services/group-orders/group-orders.service';
import { LocationsService } from '@app/services/locations/locations.service';
import { NotificationsService } from '@app/services/notifications/notifications.service';
import { PreOrdersService } from '@app/services/pre-orders/pre-orders.service';
import { ReservationService } from '@app/services/reservation/reservation.service';
import { TableService } from '@app/services/table/table.service';
import { Roles } from '@app/shared/constants/roles';
import { Subject, of, tap, throwError } from 'rxjs';
import { Order } from '@app/models/orders/order.model';
import { ReservationDashboardComponent } from './reservation-dashboard.component';

function makeReservation(id: string): Reservation {
  return {
    id,
    tableId: 'table-1',
    customerId: 'customer-1',
    startTime: new Date('2026-11-04T16:00:00Z'),
    endTime: new Date('2026-11-04T17:00:00Z'),
    guestCount: 2,
    status: ReservationStatus.Reserved,
    locationAddress: 'Test Street 1',
    tableCapacity: 2,
    waiterId: '',
    restaurantName: 'Test Restaurant',
    guestInviteLinkAvailable: true,
    currentParticipants: 1,
  };
}

function makeFeedback(reservationId: string): FeedbackReservationResponseItem {
  const feedbackItem = {
    userId: 'customer-1',
    locationId: 'location-1',
    reservationId,
    username: 'Test Customer',
    rating: 5,
    comment: 'Great experience',
    createdAt: '2026-11-04T16:00:00Z',
  };

  return {
    service: { ...feedbackItem, type: 'service' },
    cuisineExperience: { ...feedbackItem, type: 'cuisine' },
  };
}

describe('ReservationDashboardComponent', () => {
  let component: ReservationDashboardComponent;
  let fixture: ComponentFixture<ReservationDashboardComponent>;
  let navigationEvents: Subject<RouterEvent>;
  let reservationUpdates: Subject<ReservationGroupUpdate>;
  let reservationService: jasmine.SpyObj<ReservationService>;
  let preOrdersService: jasmine.SpyObj<PreOrdersService>;
  let unreadNotifications: WritableSignal<Notification[]>;
  let loadNotifications: jasmine.Spy;
  let getStatusByReservationId: jasmine.Spy;

  function createDashboard(): HTMLElement {
    fixture = TestBed.createComponent(ReservationDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function returnFromGroupOrder(): void {
    navigationEvents.next(
      new NavigationEnd(
        1,
        '/reservations/reservation-1/group-order',
        '/reservations/reservation-1/group-order'
      )
    );
    navigationEvents.next(new NavigationEnd(2, '/reservations', '/reservations'));
  }

  beforeEach(async () => {
    navigationEvents = new Subject<RouterEvent>();
    reservationUpdates = new Subject<ReservationGroupUpdate>();
    unreadNotifications = signal<Notification[]>([]);
    loadNotifications = jasmine
      .createSpy('loadNotifications')
      .and.returnValue(of([]).pipe(tap((notifications) => unreadNotifications.set(notifications))));
    getStatusByReservationId = jasmine
      .createSpy('getStatusByReservationId$')
      .and.returnValue(of({ currentParticipants: 2, maxCapacity: 2, status: 'Open' as const }));
    reservationService = jasmine.createSpyObj<ReservationService>('ReservationService', [
      'getReservationsForUser$',
      'getReservationFeedback',
    ]);
    reservationService.getReservationsForUser$.and.returnValue(
      of([makeReservation('reservation-1')])
    );
    reservationService.getReservationFeedback.and.returnValue(of(null));

    preOrdersService = jasmine.createSpyObj<PreOrdersService>('PreOrdersService', ['getPreOrders']);
    preOrdersService.getPreOrders.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ReservationDashboardComponent],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            getToken: () => 'token',
            getUser: () => ({
              id: 'customer-1',
              firstName: 'Test',
              lastName: 'Customer',
              role: Roles.CUSTOMER,
            }),
          },
        },
        {
          provide: GroupOrdersService,
          useValue: {
            reservationUpdates$: reservationUpdates,
            getStatusByReservationId$: getStatusByReservationId,
            publishParticipantCount: (reservationId: string, count: number) =>
              reservationUpdates.next({ type: 'participant-count', reservationId, count }),
          },
        },
        { provide: LocationsService, useValue: {} },
        {
          provide: NotificationsService,
          useValue: {
            unreadNotifications,
            loadNotifications,
          },
        },
        { provide: PreOrdersService, useValue: preOrdersService },
        { provide: ReservationService, useValue: reservationService },
        { provide: TableService, useValue: {} },
        {
          provide: Router,
          useValue: { events: navigationEvents },
        },
      ],
    })
      .overrideComponent(ReservationDashboardComponent, {
        set: {
          template: `
            @if (!reservationsLoaded()) {
              <p>Please wait while we load your reservations.</p>
            } @else {
              <ul class="reservation-list">
                @for (reservation of reservations(); track reservation.id) {
                  <li>{{ reservation.id }}</li>
                }
              </ul>
            }
          `,
        },
      })
      .compileComponents();
  });

  it('should create', () => {
    createDashboard();
    expect(component).toBeTruthy();
  });

  it('shows the initial loading state until the first request completes', () => {
    const reservationsResponse = new Subject<Reservation[]>();
    reservationService.getReservationsForUser$.and.returnValue(reservationsResponse.asObservable());
    const element = createDashboard();

    expect(element.textContent).toContain('Please wait while we load your reservations.');

    reservationsResponse.next([makeReservation('reservation-1')]);
    reservationsResponse.complete();
    fixture.detectChanges();

    expect(element.querySelector('.reservation-list')).toBeTruthy();
    expect(element.textContent).not.toContain('Please wait while we load your reservations.');
  });

  it('renders reservations before feedback requests complete and updates only the matching reservation', () => {
    const feedbackResponses = new Map([
      ['reservation-1', new Subject<FeedbackReservationResponseItem | null>()],
      ['reservation-2', new Subject<FeedbackReservationResponseItem | null>()],
    ]);
    reservationService.getReservationsForUser$.and.returnValue(
      of([makeReservation('reservation-1'), makeReservation('reservation-2')])
    );
    reservationService.getReservationFeedback.and.callFake((reservationId) =>
      feedbackResponses.get(reservationId)!.asObservable()
    );

    const element = createDashboard();

    expect(component.reservationsLoaded()).toBeTrue();
    expect(element.querySelectorAll('.reservation-list li').length).toBe(2);
    expect(element.textContent).toContain('reservation-1');
    expect(element.textContent).toContain('reservation-2');
    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-1')?.feedback
    ).toBeUndefined();

    feedbackResponses.get('reservation-2')!.next(makeFeedback('reservation-2'));

    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-2')?.feedback
        ?.service.reservationId
    ).toBe('reservation-2');
    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-1')?.feedback
    ).toBeUndefined();
    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-2')
        ?.currentParticipants
    ).toBe(1);
  });

  it('keeps reservations visible and updates other feedback when one feedback request fails', () => {
    const feedbackResponse = new Subject<FeedbackReservationResponseItem | null>();
    const logError = spyOn(console, 'error');
    reservationService.getReservationsForUser$.and.returnValue(
      of([makeReservation('reservation-1'), makeReservation('reservation-2')])
    );
    reservationService.getReservationFeedback.and.callFake((reservationId) =>
      reservationId === 'reservation-1'
        ? throwError(() => new HttpErrorResponse({ status: 500 }))
        : feedbackResponse.asObservable()
    );

    const element = createDashboard();

    expect(component.reservationsLoaded()).toBeTrue();
    expect(element.querySelectorAll('.reservation-list li').length).toBe(2);
    expect(logError).toHaveBeenCalledOnceWith(
      'Failed to load feedback for reservation reservation-1:',
      jasmine.any(HttpErrorResponse)
    );

    feedbackResponse.next(makeFeedback('reservation-2'));

    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-2')?.feedback
        ?.service.reservationId
    ).toBe('reservation-2');
    expect(element.querySelectorAll('.reservation-list li').length).toBe(2);
  });

  it('keeps the existing list visible during refresh and replaces it on success', () => {
    const element = createDashboard();
    const reservationsResponse = new Subject<Reservation[]>();
    const ordersResponse = new Subject<Order[]>();
    reservationService.getReservationsForUser$.and.returnValue(reservationsResponse.asObservable());
    preOrdersService.getPreOrders.and.returnValue(ordersResponse.asObservable());

    returnFromGroupOrder();
    fixture.detectChanges();

    expect(element.querySelector('.reservation-list')).toBeTruthy();
    expect(element.textContent).toContain('reservation-1');
    expect(element.textContent).not.toContain('Please wait while we load your reservations.');

    reservationsResponse.next([makeReservation('reservation-2')]);
    reservationsResponse.complete();
    ordersResponse.next([]);
    ordersResponse.complete();
    fixture.detectChanges();

    expect(element.textContent).toContain('reservation-2');
    expect(element.textContent).not.toContain('reservation-1');
  });

  it('keeps the entire existing list when either refresh request fails', () => {
    const element = createDashboard();
    const logError = spyOn(console, 'error');

    reservationService.getReservationsForUser$.and.returnValue(
      throwError(() => new Error('Reservations unavailable'))
    );
    returnFromGroupOrder();
    fixture.detectChanges();

    expect(component.reservations().map((reservation) => reservation.id)).toEqual([
      'reservation-1',
    ]);
    expect(element.textContent).toContain('reservation-1');

    reservationService.getReservationsForUser$.and.returnValue(
      of([makeReservation('reservation-2')])
    );
    preOrdersService.getPreOrders.and.returnValue(
      throwError(() => new Error('Pre-orders unavailable'))
    );
    returnFromGroupOrder();
    fixture.detectChanges();

    expect(component.reservations().map((reservation) => reservation.id)).toEqual([
      'reservation-1',
    ]);
    expect(element.textContent).toContain('reservation-1');
    expect(element.textContent).not.toContain('reservation-2');
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it('does not reload reservations on the initial dashboard navigation', () => {
    createDashboard();
    navigationEvents.next(new NavigationEnd(1, '/reservations', '/reservations'));

    expect(reservationService.getReservationsForUser$).toHaveBeenCalledTimes(1);
    expect(preOrdersService.getPreOrders).toHaveBeenCalledTimes(1);
  });

  it('updates only the reservation changed by a group-order event', () => {
    reservationService.getReservationsForUser$.and.returnValue(
      of([makeReservation('reservation-1'), makeReservation('reservation-2')])
    );
    createDashboard();

    reservationUpdates.next({
      type: 'participant-count',
      reservationId: 'reservation-2',
      count: 2,
    });
    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-2')
        ?.currentParticipants
    ).toBe(2);
    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-1')
        ?.currentParticipants
    ).toBe(1);

    reservationUpdates.next({
      type: 'pre-order-submitted',
      reservationId: 'reservation-2',
    });
    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-2')
        ?.hasSubmittedPreOrder
    ).toBeTrue();
    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-1')
        ?.hasSubmittedPreOrder
    ).toBeFalse();
  });

  it('polls notifications every 15 seconds and refreshes only the notified open group count', fakeAsync(() => {
    const submittedNotification: Notification = {
      id: 'notification-1',
      message: 'A guest submitted their group pre-order.',
      reservationId: 'reservation-1',
      createdAt: '2026-11-04T16:30:00Z',
      isRead: false,
    };
    loadNotifications.and.callFake(() => {
      const notifications = loadNotifications.calls.count() === 1 ? [] : [submittedNotification];
      return of(notifications).pipe(tap(() => unreadNotifications.set(notifications)));
    });

    createDashboard();
    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-1')
        ?.currentParticipants
    ).toBe(1);
    tick(0);

    expect(loadNotifications).toHaveBeenCalledTimes(1);
    expect(getStatusByReservationId).not.toHaveBeenCalled();

    tick(14_999);
    expect(loadNotifications).toHaveBeenCalledTimes(1);

    tick(1);
    fixture.detectChanges();

    expect(loadNotifications).toHaveBeenCalledTimes(2);
    expect(getStatusByReservationId).toHaveBeenCalledOnceWith('reservation-1', { silent: true });
    expect(component.hasUnreadReservationUpdates('reservation-1')).toBeTrue();
    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-1')
        ?.currentParticipants
    ).toBe(2);

    discardPeriodicTasks();
  }));

  it('keeps the existing participant count when the notification-triggered status request fails', fakeAsync(() => {
    const notification: Notification = {
      id: 'notification-2',
      message: 'A guest joined your group pre-order.',
      reservationId: 'reservation-1',
      createdAt: '2026-11-04T16:30:00Z',
      isRead: false,
    };
    const logError = spyOn(console, 'error');
    loadNotifications.and.returnValue(
      of([notification]).pipe(tap(() => unreadNotifications.set([notification])))
    );
    getStatusByReservationId.and.returnValue(
      throwError(() => new Error('Group status unavailable'))
    );

    createDashboard();
    tick(0);

    expect(
      component.reservations().find((reservation) => reservation.id === 'reservation-1')
        ?.currentParticipants
    ).toBe(1);
    expect(logError).toHaveBeenCalled();

    discardPeriodicTasks();
  }));
});
