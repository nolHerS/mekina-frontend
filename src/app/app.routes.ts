import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home-page').then((module) => module.HomePageComponent),
  },
  {
    path: 'reservar',
    loadComponent: () =>
      import('./features/reservation/reservation-page').then(
        (module) => module.ReservationPage,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
