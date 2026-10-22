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
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login-page').then((module) => module.LoginPage),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/auth/registration-page').then(
        (module) => module.RegistrationPage,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
