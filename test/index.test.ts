import { SELF, createExecutionContext, env } from 'cloudflare:test';
import {
	describe,
	expect,
	it,
	test,
} from 'vitest';

import worker from '../src/index';
import { getKeys } from '../src/utils';

describe('Worker', () => {
	it('should return html landing page', async () => {
		const resp = await SELF.fetch('http://example.com');
		expect(resp.status).toBe(200);

		// check if html is returned
		const headers = resp.headers;
		expect(headers.get('content-type')).toBe('text/html; charset=utf-8');
		const text = await resp.text();
		expect(text).toMatch(/^<!DOCTYPE html>/);

		// ensure cache header is set (so worker is running)
		expect(headers.get('cache-control')).toBe('public, max-age=3600');
	});

	it('should set right headers for static assets', async () => {
		const resp = await SELF.fetch('http://example.com/share.png');
		expect(resp.status).toBe(200);

		const headers = resp.headers;
		expect(headers.get('content-type')).toBe('image/png');
		expect(headers.get('cache-control')).toBe('public, max-age=2592000');
	});

	it('should sanitize for XSS', async () => {
		const req = new Request('https://example.com/api/?width=350&height=100&text=Hello%20World&bgColor=%22%3E%3Cscript%3Ealert(%22XSS%22);%3C/script%3E', { method: 'GET' });
		const ctx = createExecutionContext();
		const resp = await worker.fetch(req, env, ctx);
		expect(resp.status).toBe(200);

		const text = await resp.text();
		expect(text).toMatchSnapshot();
	});

	it('should sanitize for CSS prop injection', async () => {
		const req = new Request('https://example.com/api/?width=450&height=450&text=James&fontFamily=test;background:url(https://avatars.githubusercontent.com/u/856748?v=4)&textWrap=true', { method: 'GET' });
		const ctx = createExecutionContext();
		const resp = await worker.fetch(req, env, ctx);
		expect(resp.status).toBe(200);

		const text = await resp.text();
		expect(text).toMatchSnapshot();
	});

	test.each([
		// basic tests
		[
			{
				width: 350,
				height: 100,
			},
		],
		[
			{
				width: 200,
				height: 100,
				bgColor: '#000',
				textColor: 'rgba(255,255,255,0.5)',
			},
		],
		[
			{
				width: 140,
				height: 100,
				bgColor: '#313131',
				textColor: '#dfdfde',
			},
		],
		[
			{
				width: 350,
				height: 100,
				text: 'placeholders.dev',
			},
		],
		[
			{
				width: 1055,
				height: 100,
				text: 'Hello World',
				bgColor: '#434343',
				textColor: '#dfdfde',
			},
		],
		// text wrapping
		[
			{
				width: 250,
				height: 200,
				text: 'This text is too long',
				bgColor: '#f7f6f6',
				textWrap: false,
			},
		],
		[
			{
				width: 250,
				height: 200,
				text: 'This text is too long',
				bgColor: '#f7f6f6',
				textWrap: true,
			},
		],
		// apostrophes in text
		[
			{
				width: 350,
				height: 100,
				text: 'Hello \'World\'',
				bgColor: '#f7f6f6',
			},
		],
		[
			{
				width: 350,
				height: 100,
				text: 'Hello \'World\'',
				bgColor: '#f7f6f6',
				textWrap: true,
			},
		],
	])('should return accurate svg image with query params %s', async (query) => {
		const searchParams = new URLSearchParams();
		for (const key of getKeys(query)) {
			searchParams.set(key, String(query[key]));
		}
		const req = new Request(`https://example.com/api/?${searchParams.toString()}`, { method: 'GET' });
		const ctx = createExecutionContext();
		const resp = await worker.fetch(req, env, ctx);
		expect(resp.status).toBe(200);

		const text = await resp.text();
		expect(text).toMatchSnapshot();
	});

	it('should return accurate svg image with simple path', async () => {
		const req = new Request('https://example.com/api/350', { method: 'GET' });
		const ctx = createExecutionContext();
		const resp = await worker.fetch(req, env, ctx);
		expect(resp.status).toBe(200);

		const text = await resp.text();
		expect(text).toMatchSnapshot();
	});

	it('should return accurate svg image with full url path', async () => {
		const req = new Request('https://example.com/api/350x100', { method: 'GET' });
		const ctx = createExecutionContext();
		const resp = await worker.fetch(req, env, ctx);
		expect(resp.status).toBe(200);

		const text = await resp.text();
		expect(text).toMatchSnapshot();
	});

	it('should return accurate svg image with url path and query params', async () => {
		const req = new Request('https://example.com/api/350x100?bgColor=%23f7f6f6&text=Hello%20World', { method: 'GET' });
		const ctx = createExecutionContext();
		const resp = await worker.fetch(req, env, ctx);
		expect(resp.status).toBe(200);

		const text = await resp.text();
		expect(text).toMatchSnapshot();
	});

	it('should return accurate svg image with url path and query params overriding', async () => {
		const req = new Request('https://example.com/api/350x100?width=360&height=200', { method: 'GET' });
		const ctx = createExecutionContext();
		const resp = await worker.fetch(req, env, ctx);
		expect(resp.status).toBe(200);

		const text = await resp.text();
		expect(text).toMatchSnapshot();
	});
});
