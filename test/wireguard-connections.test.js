const assert = require('node:assert/strict');
const Config = require('../FritzConfigDocument.js');
const WireGuard = require('../FritzWireGuardConnections.js');

const source = [
  '**** CFGFILE:vpn.cfg',
  'vpncfg {',
  '  global { wg_private_key = "$$$$PRIVATE"; wg_public_key = "box-public"; wg_listen_port = 51820; }',
  '  connections { enabled = yes; name = "Office"; wg_public_key = "peer-one"; wg_preshared_key = "$$$$PSK1"; wg_allowed_ips = "10.0.0.0/24", wg_dyndns = "office.example"; wg_configured = yes; } {',
  '    enabled = no; name = "Mobile"; wg_public_key = "peer-two"; wg_preshared_key = "$$$$PSK2"; wg_allowed_ips = "192.0.2.4/32", wg_dyndns = "mobile.example"; wg_persistent_keepalive = 25; wg_configured = yes;',
  '  } { enabled = yes; name = "Legacy IPsec"; wg_configured = no; }',
  '}',
  '**** END OF FILE ****'
].join('\r\n');

const document = Config.parse(source);
const model = WireGuard.project(document);
assert.equal(model.global.values.wg_public_key, 'box-public');
assert.equal(model.global.values.wg_listen_port, '51820');
assert.deepEqual(model.connections.map(item => item.values.name), ['Office', 'Mobile']);
assert.deepEqual(model.connections.map(item => item.values.wg_allowed_ips), ['10.0.0.0/24', '192.0.2.4/32']);
assert.equal(model.connections[1].values.wg_persistent_keepalive, '25');

const secretStart = source.indexOf('$$$$PSK2');
assert.equal(WireGuard.findBySecret(model, { start: secretStart, end: secretStart + 8 }).values.name, 'Mobile');

const updated = WireGuard.update(document, model.connections[1], {
  enabled: 'yes',
  name: 'Phone',
  wg_dyndns: 'phone.example'
});
assert.match(updated, /enabled = yes; name = "Phone";[\s\S]*wg_dyndns = "phone\.example";/);
assert.match(updated, /wg_preshared_key = "\$\$\$\$PSK2";/, 'secret values must remain untouched');
assert.match(updated, /connections \{ enabled = yes; name = "Office";/, 'other connection blocks must remain untouched');

console.log('WireGuard connection projection tests passed.');
