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
});
