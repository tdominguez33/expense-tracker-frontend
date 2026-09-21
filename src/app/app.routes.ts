import { Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { Dashboard } from './views/dashboard/dashboard';
import { Transactions } from './views/transactions/transactions';
import { Statements } from './views/statements/statements';
import { Settings } from './views/settings/settings';
import { HistoryView } from './views/history/history';

import { authGuard } from './guards/auth.guard';
import { LoginView } from './views/login/login';

export const routes: Routes = [
  { path: 'login', component: LoginView },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'history', component: HistoryView },
      { path: 'transactions', component: Transactions },
      { path: 'statements', component: Statements },
      { path: 'statements/account/:accountId', component: Statements },
      { path: 'statements/:id', component: Statements },
      { path: 'settings', component: Settings }
    ]
  },
  { path: '**', redirectTo: '' }
];
