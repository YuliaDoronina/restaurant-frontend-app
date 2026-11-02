import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, switchMap, throwError } from 'rxjs';
import { SKIP_ERROR_TOAST } from '../../auth/skip-error-toast.context';
import { GroupSessionsResponse } from '../../models/group-orders/group-sessions-response.model';
import { GroupStatusResponse } from '../../models/group-orders/group-status.model';
import { OwnerSessionResponse } from '../../models/group-orders/owner-session.model';
import { SubmittedDish, SubmitGroupPreOrderRequest } from '../../models/group-orders/submit-group-pre-order.model';
import { GuestInvite } from '../../models/reservations/guest-invite.model';
import { ReservationCustomer } from '../../models/reservations/reservation.model';
import { API_BASE_URL } from '../../shared/config/api-base-url.token';
import { GuestInviteService } from '../reservation/guest-invite.service';

export interface GroupRequestOptions {
  silent?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GroupOrdersService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);
  private readonly guestInviteService = inject(GuestInviteService);

  getGroupInvite$(reservationId: string): Observable<GuestInvite> {
    return this.guestInviteService
      .getInviteToken$(reservationId)
      .pipe(
        switchMap(({ token }) => this.guestInviteService.getInvite$(token)),
        catchError((inviteError: unknown) =>
          forkJoin({
            ownerContext: this.http.get<OwnerSessionResponse>(
              `${this.baseUrl}/reservations/${encodeURIComponent(reservationId)}/guest-session-id`,
            ),
            reservation: this.http.get<ReservationCustomer>(
              `${this.baseUrl}/reservations/${encodeURIComponent(reservationId)}`,
            ),
          }).pipe(
            map(({ ownerContext, reservation }) => ({
              GroupReservationId: ownerContext.groupReservationId,
              LocationId: reservation.tableId,
              RestaurantName: reservation.restaurantName,
              LocationAddress: reservation.locationAddress,
              StartTime: reservation.startTime.toString(),
              EndTime: reservation.endTime.toString(),
              MaxGuestCount: reservation.guestCount,
              TableNumber: 0,
              InviterName: '',
            })),
            catchError(() => throwError(() => inviteError)),
          ),
        ),
      );
  }

  getSessions$(groupReservationId: string, options: GroupRequestOptions = {}): Observable<GroupSessionsResponse> {
    return this.http.get<GroupSessionsResponse>(
      `${this.baseUrl}/guest/groups/${encodeURIComponent(groupReservationId)}/sessions`,
      { context: new HttpContext().set(SKIP_ERROR_TOAST, options.silent ?? false) },
    );
  }

  getOwnerSessionId$(reservationId: string): Observable<string> {
    return this.http
      .get<OwnerSessionResponse>(
        `${this.baseUrl}/reservations/${encodeURIComponent(reservationId)}/guest-session-id`,
      )
      .pipe(map(({ guestSessionId }) => guestSessionId));
  }

  getStatus$(groupReservationId: string, options: GroupRequestOptions = {}): Observable<GroupStatusResponse> {
    return this.http.get<GroupStatusResponse>(
      `${this.baseUrl}/guest/groups/${encodeURIComponent(groupReservationId)}/status`,
      { context: new HttpContext().set(SKIP_ERROR_TOAST, options.silent ?? false) },
    );
  }

  removeSession$(groupReservationId: string, guestSessionId: string): Observable<GroupSessionsResponse> {
    return this.http.delete<GroupSessionsResponse>(
      `${this.baseUrl}/guest/groups/${encodeURIComponent(groupReservationId)}/sessions/${encodeURIComponent(guestSessionId)}`,
    );
  }

  submit$(groupReservationId: string, reservationId: string): Observable<SubmittedDish[]> {
    const request: SubmitGroupPreOrderRequest = { reservationId };
    return this.http.post<SubmittedDish[]>(
      `${this.baseUrl}/group-reservations/${encodeURIComponent(groupReservationId)}/submit`,
      request,
    );
  }
}
