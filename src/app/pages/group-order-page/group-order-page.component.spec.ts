// Рівень 2 · сторінка на даних з API. Сервіс підмінено шпигуном — у мережу тест не ходить.
// Запуск: npm run test:hw
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { GroupOrdersService } from '@app/services/group-orders/group-orders.service';
import { NotificationsService } from '@app/services/notifications/notifications.service';
import { PreOrdersService } from '@app/services/pre-orders/pre-orders.service';
import { ToastService } from '@app/services/toast/toast.service';
import { GroupSessionsResponse } from '@app/models/group-orders/group-sessions-response.model';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GroupOrderPageComponent } from './group-order-page.component';

const caesar = { id: 'dish1', name: 'Caesar Salad', price: 180 };
const tomYum = { id: 'dish2', name: 'Tom Yum', price: 220 };

const SESSIONS: GroupSessionsResponse = {
  participants: [
    {
      id: 'owner',
      type: 'Owner',
      name: 'Yevhenii',
      isSubmitted: true,
      total: 180,
      items: [{ dish: caesar, quantity: 1 }],
    },
    {
      id: 'andrii',
      type: 'Guest',
      name: 'Andrii',
      isSubmitted: true,
      total: 360,
      items: [{ dish: caesar, quantity: 2 }],
    },
    {
      id: 'olena',
      type: 'Guest',
      name: 'Olena',
      isSubmitted: false,
      total: 220,
      items: [{ dish: tomYum, quantity: 1 }],
    },
  ],
  total: 760,
};
const INVITE = {
  GroupReservationId: 'grp-1',
  LocationAddress: 'Rustaveli Avenue 48',
  MaxGuestCount: 5,
  StartTime: '2026-10-21T16:00:00Z',
  EndTime: '2026-10-21T17:30:00Z',
} as GuestInvite;

function buttonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;
}

describe('Рівень 2 · сторінка Owner Review', () => {
  let service: jasmine.SpyObj<GroupOrdersService>;
  let preOrders: jasmine.SpyObj<PreOrdersService>;
  let notifications: jasmine.SpyObj<NotificationsService>;

  function create() {
    TestBed.configureTestingModule({
      imports: [GroupOrderPageComponent],
      providers: [
        { provide: GroupOrdersService, useValue: service },
        { provide: PreOrdersService, useValue: preOrders },
        { provide: NotificationsService, useValue: notifications },
        {
          provide: ToastService,
          useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'info']),
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ reservationId: 'res-1' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(GroupOrderPageComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    preOrders = jasmine.createSpyObj<PreOrdersService>('PreOrdersService', [
      'updateOrderItemsByReservationId',
    ]);
    preOrders.updateOrderItemsByReservationId.and.returnValue(of({}));
    notifications = jasmine.createSpyObj<NotificationsService>('NotificationsService', [
      'markReservationNotificationsAsRead',
    ]);
    notifications.markReservationNotificationsAsRead.and.returnValue(of(void 0));
    service = jasmine.createSpyObj<GroupOrdersService>('GroupOrdersService', [
      'getGroupInvite$',
      'getSessions$',
      'getOwnerSessionId$',
      'getStatus$',
      'submit$',
      'updateGroupSessionDish$',
    ]);
    service.getGroupInvite$.and.returnValue(of(INVITE));
    service.getSessions$.and.returnValue(of(structuredClone(SESSIONS)));
    service.getOwnerSessionId$.and.returnValue(of('owner'));
    service.getStatus$.and.returnValue(
      of({ currentParticipants: 3, maxCapacity: 5, status: 'Open' as const })
    );
    service.updateGroupSessionDish$.and.returnValue(of(structuredClone(SESSIONS)));
  });

  describe('дані', () => {
    it('бере reservationId з адреси і вантажить групу за GroupReservationId', () => {
      create();
      expect(service.getGroupInvite$).toHaveBeenCalledWith('res-1');
      expect(service.getSessions$.calls.mostRecent().args[0]).toBe('grp-1');
      expect(notifications.markReservationNotificationsAsRead).toHaveBeenCalledOnceWith('res-1');
    });

    it('показує всіх учасників; власна картка — «My Pre-Order»', () => {
      const { element } = create();
      expect(element.querySelectorAll('app-participant-card').length).toBe(3);
      expect(element.textContent).toContain('My Pre-Order');
      expect(element.textContent).toContain('Guest: Andrii');
    });

    it('бейдж статусу: «Collecting pre-orders»', () => {
      expect(create().element.textContent).toContain('Collecting pre-orders');
    });
  });

  describe('консолідоване замовлення', () => {
    it('Grand Total включає страви з усіх кошиків: $760', () => {
      const text = create().element.textContent ?? '';
      expect(text).toContain('$760.00');
      expect(text).not.toContain('$540.00');
    });

    it('однакові страви — одним рядком: «Caesar Salad × 3»', () => {
      expect(create().element.textContent).toContain('Caesar Salad × 3');
    });

    it('додає до списку страви з непідтверджених кошиків', () => {
      expect(create().element.textContent).toContain('Tom Yum × 1');
    });

    it('жовта плашка попереджає про гостя, який ще обирає', () => {
      expect(create().element.textContent).toMatch(/1 guest is still choosing dishes/);
    });
  });

  describe('редагування кошиків', () => {
    it('не відправляє видалення чи збільшення для гостя зі статусом «Still choosing»', () => {
      const { fixture } = create();

      fixture.componentInstance.removeDish('olena', 'dish2');
      fixture.componentInstance.changeDishQuantity('olena', { dishId: 'dish2', change: 1 });

      expect(service.updateGroupSessionDish$).not.toHaveBeenCalled();
    });

    it('дозволяє власнику та гостю зі статусом «Submitted» змінювати страви', () => {
      const { fixture } = create();

      fixture.componentInstance.removeDish('andrii', 'dish1');
      fixture.componentInstance.changeDishQuantity('owner', { dishId: 'dish1', change: 1 });

      expect(service.updateGroupSessionDish$).toHaveBeenCalledTimes(1);
      expect(service.updateGroupSessionDish$).toHaveBeenCalledWith('grp-1', 'andrii', 'dish1', 0);
      expect(preOrders.updateOrderItemsByReservationId).toHaveBeenCalledWith('res-1', [
        { dishId: 'dish1', quantity: 2 },
      ]);
    });

    it('записує зміни страв власника в Orders, а не в його порожню GuestSession', () => {
      const { fixture } = create();

      fixture.componentInstance.changeDishQuantity('owner', { dishId: 'dish1', change: 1 });
      fixture.componentInstance.removeDish('owner', 'dish1');

      expect(preOrders.updateOrderItemsByReservationId).toHaveBeenCalledWith('res-1', [
        { dishId: 'dish1', quantity: 2 },
      ]);
      expect(preOrders.updateOrderItemsByReservationId).toHaveBeenCalledWith('res-1', []);
      expect(service.updateGroupSessionDish$).not.toHaveBeenCalled();
      expect(service.getSessions$).toHaveBeenCalledTimes(3);
    });
  });

  describe('стани екрана', () => {
    it('порожньо: «Participants haven’t added any dishes yet»', () => {
      const empty = structuredClone(SESSIONS);
      empty.participants.forEach((p) => (p.items = []));
      service.getSessions$.and.returnValue(of(empty));
      expect(create().element.textContent).toMatch(/Participants haven.t added any dishes yet/);
    });

    it('404: «Group reservation not found»', () => {
      service.getGroupInvite$.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 404 }))
      );
      expect(create().element.textContent).toContain('Group reservation not found');
    });

    it('інша помилка: кнопка «Try again» вантажить ще раз', () => {
      service.getGroupInvite$.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );
      const { fixture, element } = create();
      buttonByText(element, 'Try again')?.click();
      fixture.detectChanges();
      expect(service.getGroupInvite$).toHaveBeenCalledTimes(2);
    });
  });

  describe('Submit Pre-Order', () => {
    beforeEach(() => {
      const allSubmitted = structuredClone(SESSIONS);
      allSubmitted.participants.forEach((participant) => {
        if (participant.type === 'Guest') participant.isSubmitted = true;
      });
      service.getSessions$.and.returnValue(of(allSubmitted));
    });

    it('кнопка неактивна, якщо всі кошики порожні та немає гостей, які очікують', () => {
      const emptyOrder = structuredClone(SESSIONS);
      emptyOrder.participants.forEach((participant) => {
        participant.isSubmitted = true;
        participant.items = [];
        participant.total = 0;
      });
      service.getSessions$.and.returnValue(of(emptyOrder));
      expect(buttonByText(create().element, 'Submit Pre-Order')?.disabled).toBeTrue();
    });

    it('дозволяє відкрити попередження для гостей, які ще обирають, без страв чи відправлення', () => {
      const pendingOnly = structuredClone(SESSIONS);
      pendingOnly.participants.forEach((participant) => {
        participant.isSubmitted = false;
        participant.items = [];
        participant.total = 0;
      });
      service.getSessions$.and.returnValue(of(pendingOnly));
      const { fixture, element } = create();

      const submitButton = buttonByText(element, 'Submit Pre-Order');
      expect(submitButton?.disabled).toBeFalse();
      submitButton?.click();
      fixture.detectChanges();

      const dialog = element.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain('Guests Still Choosing');
      expect(dialog?.textContent).toContain('Olena');
      expect(dialog?.textContent).toContain('Andrii');
      expect(dialog?.textContent).toContain('Please wait');
      expect(element.textContent).not.toContain('Confirm Pre-Order');
      expect(service.submit$).not.toHaveBeenCalled();

      buttonByText(dialog!, "OK, I'll wait")?.click();
      fixture.detectChanges();
      expect(element.querySelector('[role="dialog"]')).toBeNull();
      expect(service.submit$).not.toHaveBeenCalled();
    });

    it('«Submit Pre-Order» → діалог → «Submit»: запит іде один раз навіть при подвійному кліку', () => {
      const response$ = new Subject<{ dishId: string; quantity: number }[]>();
      service.submit$.and.returnValue(response$);
      const { fixture, element } = create();

      buttonByText(element, 'Submit Pre-Order')?.click();
      fixture.detectChanges();
      const dialog = element.querySelector('[role="dialog"]');
      expect(dialog).withContext('має відкритись <app-modal>').not.toBeNull();

      buttonByText(dialog!, 'Submit')?.click();
      fixture.detectChanges();
      buttonByText(dialog!, 'Submit')?.click();
      buttonByText(dialog!, 'Submitting…')?.click();
      fixture.detectChanges();

      expect(service.submit$).toHaveBeenCalledOnceWith('grp-1', 'res-1');
    });

    it('після успіху: «Sent to Restaurant», кнопки Submit більше немає', () => {
      service.submit$.and.returnValue(of([{ dishId: 'dish1', quantity: 3 }]));
      const { fixture, element } = create();
      buttonByText(element, 'Submit Pre-Order')?.click();
      fixture.detectChanges();
      buttonByText(element.querySelector('[role="dialog"]')!, 'Submit')?.click();
      fixture.detectChanges();

      expect(element.textContent).toContain('Sent to Restaurant');
      expect(buttonByText(element, 'Submit Pre-Order')).toBeUndefined();
    });

    it('помилка submit: екран не ламається, кнопку можна натиснути знову', () => {
      service.submit$.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
      const { fixture, element } = create();
      buttonByText(element, 'Submit Pre-Order')?.click();
      fixture.detectChanges();
      buttonByText(element.querySelector('[role="dialog"]')!, 'Submit')?.click();
      fixture.detectChanges();

      expect(buttonByText(element, 'Submit Pre-Order')?.disabled).toBeFalse();
    });
  });
});
