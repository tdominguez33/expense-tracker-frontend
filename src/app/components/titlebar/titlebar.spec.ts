import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TitlebarComponent } from './titlebar';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TitlebarComponent', () => {
  let component: TitlebarComponent;
  let fixture: ComponentFixture<TitlebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TitlebarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TitlebarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not display header by default in non-Tauri environment', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const header = fixture.nativeElement.querySelector('header');
    expect(header).toBeNull();
  });

  it('should display header with draggable region and 3 buttons when forceShow is true', async () => {
    component.forceShow = true;
    component.ngOnInit();
    fixture.detectChanges();
    await fixture.whenStable();

    const header = fixture.nativeElement.querySelector('header');
    expect(header).toBeTruthy();
    expect(header.getAttribute('data-tauri-drag-region')).not.toBeNull();

    const buttons = header.querySelectorAll('button');
    expect(buttons.length).toBe(3);

    const minBtn = buttons[0];
    const maxBtn = buttons[1];
    const closeBtn = buttons[2];

    expect(minBtn.getAttribute('title')).toBe('Minimizar');
    expect(maxBtn.getAttribute('title')).toBe('Maximizar');
    expect(closeBtn.getAttribute('title')).toBe('Cerrar');
  });

  it('should toggle maximize state and switch icon', async () => {
    component.forceShow = true;
    component.ngOnInit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isMaximized()).toBe(false);

    // Call toggleMaximize
    await component.toggleMaximize();
    expect(component.isMaximized()).toBe(true);

    fixture.detectChanges();
    const maxBtn = fixture.nativeElement.querySelector('button[title="Restaurar"]');
    expect(maxBtn).toBeTruthy();

    await component.toggleMaximize();
    expect(component.isMaximized()).toBe(false);

    fixture.detectChanges();
    const restoreBtn = fixture.nativeElement.querySelector('button[title="Maximizar"]');
    expect(restoreBtn).toBeTruthy();
  });

  it('should call minimize, toggleMaximize, and close when buttons are clicked', async () => {
    component.forceShow = true;
    component.ngOnInit();
    fixture.detectChanges();
    await fixture.whenStable();

    const minSpy = vi.spyOn(component, 'minimize');
    const maxSpy = vi.spyOn(component, 'toggleMaximize');
    const closeSpy = vi.spyOn(component, 'close');

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    expect(minSpy).toHaveBeenCalled();

    buttons[1].click();
    expect(maxSpy).toHaveBeenCalled();

    buttons[2].click();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should set --titlebar-height CSS property when desktop titlebar is active and reset on destroy', async () => {
    component.forceShow = true;
    await component.ngOnInit();
    expect(document.documentElement.style.getPropertyValue('--titlebar-height')).toBe('2rem');

    component.ngOnDestroy();
    expect(document.documentElement.style.getPropertyValue('--titlebar-height')).toBe('0px');
  });
});
