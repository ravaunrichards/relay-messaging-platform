const test=require('node:test');const assert=require('node:assert/strict');const {hash,tokenFor}=require('../server');
test('password hashes use unique random salts and verify deterministically',()=>{const a=hash('strong-password'),b=hash('strong-password');assert.notEqual(a.salt,b.salt);assert.notEqual(a.hash,b.hash);assert.equal(hash('strong-password',a.salt).hash,a.hash);});
test('signed tokens include a payload and signature',()=>{const t=tokenFor('user-1');assert.equal(t.split('.').length,2);assert.ok(t.length>30);});
