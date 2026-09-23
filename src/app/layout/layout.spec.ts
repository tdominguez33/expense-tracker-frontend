import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { Layout } from './layout';

describe('Layout', () => {
  let component: Layout;
  let fixture: ComponentFixture<Layout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Layout],
      providers: [provideRouter([]), provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Layout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the app icon next to the title in the navbar', () => {
    const navbarImg = fixture.nativeElement.querySelector('.navbar img[alt="Logo"]') as HTMLImageElement;
    expect(navbarImg).toBeTruthy();
    expect(navbarImg.getAttribute('src')).toBe('icon.png');
  });

  it('should toggle theme and update meta theme-color tag', () => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }

    component.isDarkTheme = true;
    component.toggleTheme(); // switches to false (corporate/light)
    expect(component.isDarkTheme).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('corporate');
    expect(meta.getAttribute('content')).toBe('#f2f2f2');

    component.toggleTheme(); // switches back to true (dark)
    expect(component.isDarkTheme).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(meta.getAttribute('content')).toBe('#191e24');
  });

  it('should open drawer on edge swipe right and close on swipe left', () => {
    // Set viewport width to mobile (< 1024)
    vi.stubGlobal('innerWidth', 375);

    const drawer = fixture.nativeElement.querySelector('#my-drawer-2') as HTMLInputElement;
    expect(drawer.checked).toBe(false);

    // 1. Edge swipe starting at clientX = 20, moving to 120
    const preventDefaultMock = vi.fn();
    component.onGlobalTouchStart({
      touches: [{ clientX: 20, clientY: 200 }],
      cancelable: true,
      preventDefault: preventDefaultMock
    } as any);

    expect(preventDefaultMock).toHaveBeenCalled();

    component.onGlobalTouchMove({
      touches: [{ clientX: 80, clientY: 205 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchEnd({
      touches: []
    } as any);

    // Wait, onGlobalTouchEnd checks currentTouchX which was updated in touchmove to 80
    // deltaX = 80 - 20 = 60 (> 40)
    expect(drawer.checked).toBe(true);

    // 2. Swipe left to close drawer
    component.onGlobalTouchStart({
      touches: [{ clientX: 200, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchMove({
      touches: [{ clientX: 100, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchEnd({
      touches: []
    } as any);

    expect(drawer.checked).toBe(false);

    // 3. Swipe starting in middle of screen (clientX = 150) should NOT open drawer
    component.onGlobalTouchStart({
      touches: [{ clientX: 150, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchMove({
      touches: [{ clientX: 250, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchEnd({
      touches: []
    } as any);

    expect(drawer.checked).toBe(false);

    vi.unstubAllGlobals();
  });

  it('should not intercept touches or start edge swipe when touching inside the navbar or on the menu button', () => {
    vi.stubGlobal('innerWidth', 375);
    const preventDefaultMock = vi.fn();

    const navbarBtn = fixture.nativeElement.querySelector('label[for="my-drawer-2"]') as HTMLElement;
    expect(navbarBtn).toBeTruthy();

    component.onGlobalTouchStart({
      touches: [{ clientX: 20, clientY: 30 }],
      target: navbarBtn,
      cancelable: true,
      preventDefault: preventDefaultMock
    } as any);

    expect(preventDefaultMock).not.toHaveBeenCalled();
    expect(component['isEdgeSwiping']).toBe(false);

    vi.unstubAllGlobals();
  });

  it('should not intercept touches or start edge swipe when touching an interactive button near the screen edge', () => {
    vi.stubGlobal('innerWidth', 375);
    const preventDefaultMock = vi.fn();

    const button = document.createElement('button');
    button.className = 'btn btn-circle';

    component.onGlobalTouchStart({
      touches: [{ clientX: 15, clientY: 150 }],
      target: button,
      cancelable: true,
      preventDefault: preventDefaultMock
    } as any);

    expect(preventDefaultMock).not.toHaveBeenCalled();
    expect(component['isEdgeSwiping']).toBe(false);

    vi.unstubAllGlobals();
  });
});
