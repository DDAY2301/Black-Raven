import test from 'node:test';
import assert from 'node:assert/strict';
import { validateItem, verifyAccess, handleContent } from '../src/content.js';

const base = { id:'verified-2026-0001', titleSl:'Potrjen tečaj',
  startDate:'2026-12-12', endDate:'2026-12-13', status:'draft',
  descriptionSl:'Vikend šola', location:'Slovenija' };

test('Draft event may be kept privately without a source', () => {
  const item = validateItem('events', base);
  assert.equal(item.status, 'draft');
});
test('Published event must be sourced or confirmed by organiser', () => {
  assert.throws(() => validateItem('events', {...base,status:'published'}), /vir|potrdi/);
  assert.equal(validateItem('events', {...base,status:'published',confirmed:true}).status, 'published');
  assert.equal(validateItem('events', {...base,status:'published',sourceUrl:'https://example.com/post'}).status, 'published');
});
test('Reject invalid or inverted dates and unsafe links', () => {
  assert.throws(() => validateItem('events', {...base,startDate:'2026-02-31'}));
  assert.throws(() => validateItem('events', {...base,endDate:'2026-12-11'}));
  assert.throws(() => validateItem('events', {...base,sourceUrl:'javascript:alert(1)'}));
  assert.throws(() => validateItem('events', {...base,registrationUrl:'http://example.com'}));
});
test('Blog publication needs substantive text', () => {
  assert.throws(() => validateItem('posts', {id:'blog-2026-0001',titleSl:'Naslov',publishedAt:'2026-12-01',status:'published',bodySl:'Kratko.'}));
  assert.equal(validateItem('posts',{id:'blog-2026-0001',titleSl:'Naslov',publishedAt:'2026-12-01',status:'draft'}).status,'draft');
});
test('Editor access fails closed without approved Cloudflare identity', async () => {
  assert.equal(await verifyAccess('',{}), false);
  const response = await handleContent(new Request('https://test.example/admin/events'),{},new URL('https://test.example/admin/events'));
  assert.equal(response.status,503);
});
test('Public content excludes drafts', async () => {
  const env={SITE_ORIGINS:'https://blackraven.solutions', CONTENT_KV:{
    async get() {return {version:'1',items:[
      {...base,id:'verified-2026-0001',status:'published',confirmed:true},
      {...base,id:'draft-2026-0002',status:'draft'}
    ]};}
  }};
  const url=new URL('https://api.example/events');
  const req=new Request(url,{headers:{Origin:'https://blackraven.solutions'}});
  const response=await handleContent(req,env,url);
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.events.length,1);
  assert.equal(payload.events[0].id,'verified-2026-0001');
});
