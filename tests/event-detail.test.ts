import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MaterialLink } from '../src/components/events/MaterialLink';
import type { ActivityMaterial } from '../src/lib/activity-materials';

test('cloud links remain usable without thumbnails and expose extraction notes', () => {
  const material = { id: 1, event_id: 1, material_type: 'ppt', title: 'PPT', url: 'https://pan.example.com/a', access_note: '提取码：ivory' } as ActivityMaterial;
  const html = renderToStaticMarkup(React.createElement(MaterialLink, { material }));
  assert.match(html, /target="_blank"/);
  assert.match(html, /提取码：ivory/);
  assert.match(html, /https:\/\/pan.example.com\/a/);
  const note = renderToStaticMarkup(React.createElement(MaterialLink, { material: { ...material, url: null } }));
  assert.doesNotMatch(note, /<a /);
  assert.match(note, /提取码：ivory/);
});
