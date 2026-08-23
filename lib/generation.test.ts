import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AB_LOOK_IDS,
  LOOKS,
  buildPrompt,
  openaiEditParams,
  parseImageEditStream,
} from './generation.ts';

describe('buildPrompt', () => {
  it('legacy concatenates identity, look, and finish in that order', () => {
    const prompt = buildPrompt('navy-suit-tie', 'legacy');
    const identityAt = prompt.indexOf('exact facial structure');
    const lookAt = prompt.indexOf('navy suit');
    const finishAt = prompt.indexOf('85mm f/1.8');
    assert.ok(identityAt >= 0, 'identity preamble missing');
    assert.ok(lookAt >= 0, 'look missing');
    assert.ok(finishAt >= 0, 'finish missing');
    assert.ok(identityAt < lookAt && lookAt < finishAt, 'expected identity then look then finish');
  });

  it('image2 puts labeled IDENTITY before LOOK and uses photography protocol', () => {
    const prompt = buildPrompt('navy-suit-tie', 'image2');
    const identityHeader = prompt.indexOf('IDENTITY (do not violate)');
    const lookHeader = prompt.indexOf('LOOK:');
    const cameraHeader = prompt.indexOf('CAMERA:');
    assert.ok(identityHeader >= 0, 'IDENTITY section missing');
    assert.ok(lookHeader >= 0, 'LOOK section missing');
    assert.ok(cameraHeader >= 0, 'CAMERA section missing');
    assert.ok(identityHeader < lookHeader, 'identity must come before look');
    assert.match(prompt, /navy suit/i);
    assert.match(prompt, /85mm/);
    assert.match(prompt, /1024x1536|portrait|chest up/i);
    assert.match(prompt, /Do NOT smooth|no airbrush|do not beautify/i);
  });

  it('rejects an unknown look', () => {
    assert.throws(() => buildPrompt('not-a-look', 'legacy'), /Invalid look/);
  });
});

describe('openaiEditParams', () => {
  it('legacy uses gpt-image-1.5 at 1024x1024 high', () => {
    assert.deepEqual(openaiEditParams('legacy'), {
      model: 'gpt-image-1.5',
      size: '1024x1024',
      quality: 'high',
      input_fidelity: 'high',
    });
  });

  it('image2 uses gpt-image-2 at 1024x1536 high without input_fidelity', () => {
    assert.deepEqual(openaiEditParams('image2'), {
      model: 'gpt-image-2',
      size: '1024x1536',
      quality: 'high',
    });
  });
});

describe('parseImageEditStream', () => {
  it('returns the completed image, not a partial', () => {
    const sse = [
      'event: image_edit.partial_image',
      'data: {"type":"image_edit.partial_image","b64_json":"AAA"}',
      '',
      'event: image_edit.completed',
      'data: {"type":"image_edit.completed","b64_json":"BBB"}',
      '',
    ].join('\n');
    assert.equal(parseImageEditStream(sse), 'BBB');
  });
});

describe('AB_LOOK_IDS', () => {
  it('is the four looks used for the resurrection A/B', () => {
    assert.deepEqual(AB_LOOK_IDS, [
      'navy-suit-tie',
      'coffee-shop',
      'sailing',
      'crimson-editorial',
    ]);
  });
});

describe('LOOKS pack', () => {
  it('ships two dozen looks besides the master identity shot', () => {
    const pack = Object.keys(LOOKS).filter((id) => id !== 'master');
    assert.equal(pack.length, 24);
    for (const id of [
      'tan-blazer-courtyard',
      'rust-cord-bookstore',
      'seersucker-porch',
      'golf-clubhouse',
      'waterfront-sportcoat',
      'chambray-workshop',
      'cream-turtleneck-gallery',
      'knit-cabin',
    ]) {
      assert.ok(LOOKS[id], `missing look ${id}`);
      assert.match(buildPrompt(id, 'legacy'), /exact facial structure/);
    }
  });
});
