import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { Notification } from '@app/models/notifications/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  readonly unreadNotifications = signal<Notification[]>([]);

  loadNotifications(): Observable<Notification[]> {
    return this.http
      .get<Notification[]>(`${this.baseUrl}/notifications`)
      .pipe(tap((notifications) => this.unreadNotifications.set(notifications)));
  }

  markAsRead(notificationId: string): Observable<void> {
    return this.http
      .patch<void>(`${this.baseUrl}/notifications/${notificationId}/read`, {})
      .pipe(
        tap(() =>
          this.unreadNotifications.update((notifications) =>
            notifications.filter((notification) => notification.id !== notificationId)
          )
        )
      );
  }

  markReservationNotificationsAsRead(reservationId: string): Observable<void> {
    return this.loadNotifications().pipe(
      switchMap((notifications) => {
        const reservationNotifications = notifications.filter(
          (notification) => notification.reservationId === reservationId
        );

        if (reservationNotifications.length === 0) {
          return of(void 0);
        }

        return forkJoin(
          reservationNotifications.map((notification) => this.markAsRead(notification.id))
        ).pipe(map(() => void 0));
      })
    );
  }
}
