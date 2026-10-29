import test from 'node:test';
import assert from 'node:assert/strict';
import { lyricPinyin } from '../src/content/lyricPinyin.mjs';
test('lyric uses all rather than surname Du', () => {
  assert.equal(lyricPinyin('看人间故事都逃不过离别'), 'kàn rén jiān gù shì dōu táo bú guò lí bié');
});
test('polyphonic phrases', () => {
  assert.equal(lyricPinyin('音乐快乐银行行走'), 'yīn yuè kuài lè yín háng xíng zǒu');
});
test('mixed lyrics preserve English', () => {
  assert.ok(lyricPinyin('Hello 你好！').includes('Hello'));
});
test('counting lyric uses shu third tone', () => {
  assert.equal(lyricPinyin('数不完的阴晴换圆缺'), 'shǔ bù wán de yīn qíng huàn yuán quē');
  assert.equal(lyricPinyin('數不完'), 'shǔ bù wán');
});
