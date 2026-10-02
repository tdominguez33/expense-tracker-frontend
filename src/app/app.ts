import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TitlebarComponent } from './components/titlebar/titlebar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TitlebarComponent],
  templateUrl: './app.html'
})
export class App {
  title = 'frontend-angular';
}
