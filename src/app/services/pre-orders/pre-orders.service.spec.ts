import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { PreOrdersService } from './pre-orders.service';

describe('PreOrdersService group order updates', () => {
  let service: PreOrdersService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });

    service = TestBed.inject(PreOrdersService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTestingController.verify());

  it('updates the reservation order with the owner basket items', () => {
    const orderItems = [{ dishId: 'dish-1', quantity: 2 }];

    service.updateOrderItemsByReservationId('reservation-1', orderItems).subscribe();

    const request = httpTestingController.expectOne('/api/orders/reservation-1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ orderItems });
    request.flush({});
  });

  it('cancels the owner draft when its last dish is removed', () => {
    service.updateOrderItemsByReservationId('reservation-1', []).subscribe();

    const request = httpTestingController.expectOne('/api/orders/reservation-1');
    expect(request.request.method).toBe('DELETE');
    request.flush({});
  });
});
