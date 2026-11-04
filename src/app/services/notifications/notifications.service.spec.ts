import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationsService } from './notifications.service';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://test.api' },
      ],
    });
    service = TestBed.inject(NotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('marks only unread notifications for the opened reservation as read', () => {
    const notifications = [
      {
        id: 'notice-res-1',
        message: 'A guest joined.',
        reservationId: 'res-1',
        createdAt: '2026-10-21T16:00:00Z',
        isRead: false,
      },
      {
        id: 'notice-res-2',
        message: 'Another reservation update.',
        reservationId: 'res-2',
        createdAt: '2026-10-21T16:00:00Z',
        isRead: false,
      },
    ];

    service.markReservationNotificationsAsRead('res-1').subscribe();

    http.expectOne('https://test.api/notifications').flush(notifications);
    http.expectOne('https://test.api/notifications/notice-res-1/read').flush(null);

    expect(service.unreadNotifications()).toEqual([notifications[1]]);
  });
});
