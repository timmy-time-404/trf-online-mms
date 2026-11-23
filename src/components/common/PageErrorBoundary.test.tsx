// @vitest-environment jsdom
import { act, lazy, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PageErrorBoundary from './PageErrorBoundary';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it('renders a healthy page', async () => {
  await act(async () => root.render(<PageErrorBoundary><p>Travel Requests</p></PageErrorBoundary>));
  expect(container.textContent).toBe('Travel Requests');
});

it('offers recovery when a lazy page fails to download', async () => {
  const FailedPage = lazy(() => Promise.reject(new Error('Chunk unavailable')));
  await act(async () => root.render(
    <PageErrorBoundary><Suspense fallback="Loading"><FailedPage /></Suspense></PageErrorBoundary>,
  ));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Halaman gagal dimuat');
  expect(container.querySelector('button')?.textContent).toBe('Muat ulang halaman');
});
