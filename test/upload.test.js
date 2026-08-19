import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
  await app.client.login();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Upload: filename uniqueness and type validation', () => {
  test('two concurrent uploads produce unique filenames', async () => {
    const makeFile = (name) => {
      const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
      return new File([blob], name, { type: 'image/png' });
    };

    const fd1 = new FormData();
    fd1.append('imagename', makeFile('a.png'));
    fd1.append('name', 'Product A');
    fd1.append('price', '5');
    fd1.append('category', 'Food');
    fd1.append('quantity', '10');
    fd1.append('stock', '0');
    fd1.append('img', '');

    const fd2 = new FormData();
    fd2.append('imagename', makeFile('b.png'));
    fd2.append('name', 'Product B');
    fd2.append('price', '5');
    fd2.append('category', 'Food');
    fd2.append('quantity', '10');
    fd2.append('stock', '0');
    fd2.append('img', '');

    const [res1, res2] = await Promise.all([
      app.client.request('/api/inventory/product', { method: 'POST', body: fd1 }),
      app.client.request('/api/inventory/product', { method: 'POST', body: fd2 }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.data.img).toBeTruthy();
    expect(res2.data.img).toBeTruthy();
    expect(res1.data.img).not.toBe(res2.data.img);
  });

  test('non-image file is rejected on inventory upload', async () => {
    const blob = new Blob(['not an image'], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    const fd = new FormData();
    fd.append('imagename', file);
    fd.append('name', 'Product C');
    fd.append('price', '5');
    fd.append('category', 'Food');
    fd.append('quantity', '10');
    fd.append('stock', '0');
    fd.append('img', '');

    const { status } = await app.client.request('/api/inventory/product', { method: 'POST', body: fd });
    expect(status).toBe(500);
  });

  test('file extension matches actual type, not always .jpg', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    const file = new File([blob], 'photo.png', { type: 'image/png' });

    const fd = new FormData();
    fd.append('imagename', file);
    fd.append('name', 'PNG Product');
    fd.append('price', '5');
    fd.append('category', 'Food');
    fd.append('quantity', '10');
    fd.append('stock', '0');
    fd.append('img', '');

    const { data } = await app.client.request('/api/inventory/product', { method: 'POST', body: fd });
    expect(data.img).toMatch(/\.png$/);
  });
});
