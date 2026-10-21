import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SiteHeader } from '../../shared/site-header/site-header';
import { SiteFooter } from '../../shared/site-footer/site-footer';
import { ServicesSection } from './services-section';
import { VisitInformation } from './visit-information';

@Component({
  imports: [NgOptimizedImage, RouterLink, SiteHeader, SiteFooter, ServicesSection, VisitInformation],
  selector: 'app-home-page',
  styleUrl: './home-page.scss',
  templateUrl: './home-page.html',
})
export class HomePageComponent {}
