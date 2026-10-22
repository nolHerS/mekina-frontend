import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthApiService } from './core/auth/auth-api.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly authApi = inject(AuthApiService);

  ngOnInit(): void {
    this.authApi.me().subscribe({
      error: (error: unknown) =>
        console.error('No se pudo comprobar la sesión actual.', error),
    });
  }
}
