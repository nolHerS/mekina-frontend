import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { SiteHeader } from '../../shared/site-header/site-header';
import { ServicesSection } from './services-section';
import { VisitInformation } from './visit-information';

@Component({
  imports: [NgOptimizedImage, SiteHeader, ServicesSection, VisitInformation],
  selector: 'app-home-page',
  styleUrl: './home-page.scss',
  templateUrl: './home-page.html',
})
export class HomePageComponent {}
