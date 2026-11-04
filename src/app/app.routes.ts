import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./views/login/login').then(m => m.LoginView)
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout').then(m => m.Layout),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./views/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'history',
        loadComponent: () => import('./views/history/history').then(m => m.HistoryView)
      },
      {
        path: 'transactions',
        loadComponent: () => import('./views/transactions/transactions').then(m => m.Transactions)
      },
      {
        path: 'statements',
        loadComponent: () => import('./views/statements/statements').then(m => m.Statements)
      },
      {
        path: 'statements/account/:accountId',
        loadComponent: () => import('./views/statements/statements').then(m => m.Statements)
      },
      {
        path: 'statements/:id',
        loadComponent: () => import('./views/statements/statements').then(m => m.Statements)
      },
      {
        path: 'settings',
        loadComponent: () => import('./views/settings/settings').then(m => m.Settings)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
