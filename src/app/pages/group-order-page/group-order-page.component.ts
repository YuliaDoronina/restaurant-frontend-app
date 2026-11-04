import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  exhaustMap,
  finalize,
  forkJoin,
  map,
  switchMap,
  takeWhile,
  tap,
  timer,
} from 'rxjs';
import {
  ParticipantCardComponent,
  ParticipantDishQuantityChange,
} from '../../components/group-orders/participant-card/participant-card.component';
import { GroupReservationStatus } from '../../models/group-orders/group-status.model';
import { Participant } from '../../models/group-orders/participant.model';
import { GuestInvite } from '../../models/reservations/guest-invite.model';
import { GroupOrdersService } from '../../services/group-orders/group-orders.service';
import { NotificationsService } from '@app/services/notifications/notifications.service';
import { PreOrdersService } from '../../services/pre-orders/pre-orders.service';
import { ToastService } from '../../services/toast/toast.service';
import { ModalComponent } from '../../shared/custom-components/modal/modal.component';
import { consolidatePreOrder } from '../../shared/helpers/consolidate-pre-order';

@Component({
  selector: 'app-group-order-page',
  imports: [ParticipantCardComponent, CurrencyPipe, DatePipe, ModalComponent, RouterLink],
  templateUrl: './group-order-page.component.html',
  styleUrl: './group-order-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class GroupOrderPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly groupOrders = inject(GroupOrdersService);
  private readonly notifications = inject(NotificationsService);
  private readonly preOrders = inject(PreOrdersService);
  private readonly toast = inject(ToastService);
  private loadSubscription: Subscription | null = null;
  private pollingSubscription: Subscription | null = null;

  readonly reservationId = signal('');
  readonly invite = signal<GuestInvite | null>(null);
  readonly participants = signal<Participant[]>([]);
  readonly ownerSessionId = signal<string | null>(null);
  readonly status = signal<GroupReservationStatus | null>(null);
  readonly currentParticipants = signal(0);
  readonly maxCapacity = signal(0);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly submitting = signal(false);
  readonly dishUpdateInProgress = signal(false);
  readonly isRefreshing = signal(false);
  readonly refreshFailed = signal(false);
  readonly lastUpdatedAt = signal<Date | null>(null);
  readonly confirmSubmitOpen = signal(false);
  readonly waitingForGuestsOpen = signal(false);
  readonly guestToRemove = signal<Participant | null>(null);
  readonly removingGuestId = signal<string | null>(null);

  readonly consolidatedOrder = computed(() =>
    consolidatePreOrder(
      this.participants().map((participant) => ({ ...participant, isSubmitted: true }))
    )
  );
  readonly grandTotal = computed(() =>
    this.participants().reduce((total, participant) => total + participant.total, 0)
  );
  readonly participantCount = computed(
    () => this.currentParticipants() || this.participants().length
  );
  readonly pendingGuests = computed(() =>
    this.participants().filter((person) => person.type === 'Guest' && !person.isSubmitted)
  );
  readonly pendingGuestCount = computed(() => this.pendingGuests().length);
  readonly pendingNotice = computed(() => {
    const count = this.pendingGuestCount();
    return `${count} guest${count === 1 ? ' is' : 's are'} still choosing dishes — wait for them to submit before confirming the group pre-order`;
  });
  readonly hasDishes = computed(() =>
    this.participants().some((person) => person.items.length > 0)
  );
  readonly hasSubmittedGuestDishes = computed(() =>
    this.participants().some(
      (person) => person.type === 'Guest' && person.isSubmitted && person.items.length > 0
    )
  );
  readonly hasSubmittedOwnerDishes = computed(() =>
    this.participants().some(
      (person) => person.type === 'Owner' && person.isSubmitted && person.items.length > 0
    )
  );
  readonly canSubmit = computed(
    () =>
      this.status() === 'Open' &&
      (this.pendingGuestCount() > 0 ||
        this.hasSubmittedGuestDishes() ||
        this.hasSubmittedOwnerDishes()) &&
      !this.submitting()
  );
  readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'Open':
        return 'Collecting pre-orders';
      case 'Submitted':
        return 'Sent to Restaurant';
      case 'Closed':
        return 'Closed';
      case 'Submitting':
        return 'Submitting';
      default:
        return '';
    }
  });

  constructor() {
    const reservationId = this.route.snapshot.paramMap.get('reservationId');
    if (!reservationId) {
      this.loading.set(false);
      this.errorMessage.set('Group reservation not found');
      return;
    }
    this.reservationId.set(reservationId);
    this.notifications
      .markReservationNotificationsAsRead(reservationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (error) => {
          console.error(`Failed to mark reservation ${reservationId} updates as read:`, error);
        },
      });
    this.loadData();
  }

  loadData(): void {
    const reservationId = this.reservationId();
    if (!reservationId) return;

    this.loadSubscription?.unsubscribe();
    this.stopPolling();
    this.loading.set(true);
    this.errorMessage.set('');

    this.loadSubscription = this.groupOrders
      .getGroupInvite$(reservationId)
      .pipe(
        switchMap((invite) =>
          forkJoin({
            sessions: this.groupOrders.getSessions$(invite.GroupReservationId),
            ownerSession: this.groupOrders.getOwnerSessionId$(reservationId),
            status: this.groupOrders.getStatus$(invite.GroupReservationId),
          }).pipe(map((data) => ({ invite, ...data })))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ invite, sessions, ownerSession, status }) => {
          this.invite.set(invite);
          this.participants.set(sessions.participants);
          this.ownerSessionId.set(ownerSession);
          this.status.set(status.status);
          this.currentParticipants.set(status.currentParticipants);
          this.maxCapacity.set(status.maxCapacity);
          this.groupOrders.publishParticipantCount?.(
            this.reservationId(),
            status.currentParticipants
          );
          this.lastUpdatedAt.set(new Date());
          this.refreshFailed.set(false);
          this.loading.set(false);
          this.startPolling();
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'Group reservation not found'
              : 'Could not load the group pre-order. Please try again.'
          );
        },
      });
  }

  refreshNow(): void {
    if (this.isRefreshing()) return;
    this.syncSnapshot(false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.status() === 'Open') this.startPolling();
          else this.stopPolling();
        },
      });
  }

  openSubmitConfirmation(): void {
    if (!this.canSubmit()) return;

    if (this.pendingGuestCount() > 0) {
      this.waitingForGuestsOpen.set(true);
      return;
    }

    this.confirmSubmitOpen.set(true);
  }

  closeSubmitConfirmation(): void {
    if (!this.submitting()) this.confirmSubmitOpen.set(false);
  }

  closeWaitingForGuests(): void {
    this.waitingForGuestsOpen.set(false);
  }

  requestRemoveGuest(participant: Participant): void {
    if (participant.type === 'Guest' && this.status() === 'Open') {
      this.guestToRemove.set(participant);
    }
  }

  closeRemoveGuestConfirmation(): void {
    if (!this.removingGuestId()) this.guestToRemove.set(null);
  }

  confirmRemoveGuest(): void {
    const participant = this.guestToRemove();
    const invite = this.invite();
    if (!participant || !invite || this.removingGuestId() || this.status() !== 'Open') return;

    this.removingGuestId.set(participant.id);
    this.groupOrders
      .removeSession$(invite.GroupReservationId, participant.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.removingGuestId.set(null))
      )
      .subscribe({
        next: (sessions) => {
          this.participants.set(sessions.participants);
          this.currentParticipants.set(sessions.participants.length);
          this.guestToRemove.set(null);
        },
        error: () => {
          // tokenInterceptor displays the API error; keep the current list and close the request state.
        },
      });
  }

  removeDish(participantId: string, dishId: string): void {
    if (!this.canEditParticipantDishes(participantId)) return;
    const participant = this.participants().find((person) => person.id === participantId);
    if (participant?.type === 'Owner') {
      this.updateOwnerDish(participant, dishId, 0);
      return;
    }

    this.updateGroupSessionDish(participantId, dishId, 0);
  }

  changeDishQuantity(participantId: string, change: ParticipantDishQuantityChange): void {
    const participant = this.participants().find((person) => person.id === participantId);
    const item = participant?.items.find((orderItem) => orderItem.dish.id === change.dishId);
    if (!item) return;
    if (change.change > 0 && !this.canEditParticipantDishes(participantId)) return;

    const quantity = item.quantity + change.change;
    if (quantity < 1) return;

    if (participant?.type === 'Owner') {
      this.updateOwnerDish(participant, change.dishId, quantity);
      return;
    }

    this.updateGroupSessionDish(participantId, change.dishId, quantity);
  }

  private canEditParticipantDishes(participantId: string): boolean {
    const participant = this.participants().find((person) => person.id === participantId);
    return (
      this.status() === 'Open' &&
      participant !== undefined &&
      (participant.type === 'Owner' || participant.isSubmitted)
    );
  }

  private updateOwnerDish(participant: Participant, dishId: string, quantity: number): void {
    const reservationId = this.reservationId();
    const groupReservationId = this.invite()?.GroupReservationId;
    if (!reservationId || !groupReservationId || this.dishUpdateInProgress()) return;
    if (!participant.items.some((item) => item.dish.id === dishId)) return;

    const orderItems = participant.items.flatMap((item) =>
      item.dish.id === dishId
        ? quantity === 0
          ? []
          : [{ dishId: item.dish.id, quantity }]
        : [{ dishId: item.dish.id, quantity: item.quantity }]
    );

    this.dishUpdateInProgress.set(true);
    this.preOrders
      .updateOrderItemsByReservationId(reservationId, orderItems)
      .pipe(
        switchMap(() => this.groupOrders.getSessions$(groupReservationId)),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.dishUpdateInProgress.set(false))
      )
      .subscribe({
        next: (sessions) => {
          this.participants.set(sessions.participants);
          this.lastUpdatedAt.set(new Date());
          this.refreshFailed.set(false);
        },
        error: () => {
          this.toast.error('Could not update the pre-order. Please try again.');
        },
      });
  }

  private updateGroupSessionDish(participantId: string, dishId: string, quantity: number): void {
    const groupReservationId = this.invite()?.GroupReservationId;
    if (!groupReservationId || this.dishUpdateInProgress()) return;

    this.dishUpdateInProgress.set(true);
    this.groupOrders
      .updateGroupSessionDish$(groupReservationId, participantId, dishId, quantity)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.dishUpdateInProgress.set(false))
      )
      .subscribe({
        next: (sessions) => {
          this.participants.set(sessions.participants);
          this.lastUpdatedAt.set(new Date());
          this.refreshFailed.set(false);
        },
        error: () => {
          this.toast.error('Could not update the pre-order. Please try again.');
        },
      });
  }

  confirmSubmit(): void {
    if (!this.canSubmit() || this.confirmSubmitOpen() === false) return;
    if (this.pendingGuestCount() > 0) {
      this.confirmSubmitOpen.set(false);
      this.waitingForGuestsOpen.set(true);
      return;
    }

    this.submitting.set(true);
    this.groupOrders
      .submit$(this.invite()!.GroupReservationId, this.reservationId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.status.set('Submitted');
          this.lastUpdatedAt.set(new Date());
          this.refreshFailed.set(false);
          this.confirmSubmitOpen.set(false);
          this.submitting.set(false);
          this.stopPolling();
          this.toast.success('Pre-order sent to the restaurant');
        },
        error: () => {
          this.submitting.set(false);
          this.refreshNow();
        },
      });
  }

  private startPolling(): void {
    if (this.status() !== 'Open' || (this.pollingSubscription && !this.pollingSubscription.closed))
      return;

    this.pollingSubscription = timer(15_000, 15_000)
      .pipe(
        exhaustMap(() => this.syncSnapshot(true)),
        takeWhile(() => this.status() === 'Open', true),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = null;
  }

  private syncSnapshot(silent: boolean): Observable<void> {
    const invite = this.invite();
    if (!invite || this.isRefreshing()) return EMPTY;

    this.isRefreshing.set(true);
    return forkJoin({
      sessions: this.groupOrders.getSessions$(invite.GroupReservationId, { silent }),
      status: this.groupOrders.getStatus$(invite.GroupReservationId, { silent }),
    }).pipe(
      tap(({ sessions, status }) => {
        this.participants.set(sessions.participants);
        this.currentParticipants.set(status.currentParticipants);
        this.groupOrders.publishParticipantCount?.(
          this.reservationId(),
          status.currentParticipants
        );
        this.maxCapacity.set(status.maxCapacity);
        this.status.set(status.status);
        this.lastUpdatedAt.set(new Date());
        this.refreshFailed.set(false);
      }),
      map(() => undefined),
      catchError(() => {
        this.refreshFailed.set(true);
        return EMPTY;
      }),
      finalize(() => this.isRefreshing.set(false))
    );
  }
}
