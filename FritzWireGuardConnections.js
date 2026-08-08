(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./FritzConfigDocument.js"));
  else root.FritzWireGuardConnections = factory(root.FritzConfigDocument);
})(typeof globalThis !== "undefined" ? globalThis : this, function (ConfigApi) {
  "use strict";

  const API_VERSION = "1";

  function projectNode(document, block, kind, index) {
    const assignments = document.getAssignments(block);
    const fields = Object.create(null);
    assignments.forEach(assignment => { fields[assignment.name] = assignment; });
    return {
      id: `wireguard-${kind}-${index + 1}`,
      kind,
      blockId: block.id,
      block,
      line: block.line,
      start: block.start,
      end: block.end,
      fields,
      values: Object.fromEntries(assignments.map(assignment => [assignment.name, assignment.value]))
    };
  }

  function project(document) {
    const section = document.getSection("vpn.cfg");
    if (!section) return { global: null, connections: [] };
    const globalBlock = document.getBlocks(section, block => block.name.toLowerCase() === "global")[0] || null;
    const candidates = document.getBlocks(section, block => block.name.toLowerCase() === "connections");
    const connections = candidates.map((block, index) => projectNode(document, block, "connection", index))
      .filter(connection => /^(?:yes|1|true|on)$/i.test(connection.values.wg_configured || "") ||
        ["wg_public_key", "wg_preshared_key", "wg_allowed_ips", "wg_dyndns"].some(field =>
          connection.values[field] != null && String(connection.values[field]).trim() !== ""
        ));
    return {
      global: globalBlock ? projectNode(document, globalBlock, "global", 0) : null,
      connections
    };
  }

  function findBySecret(model, secret) {
    const nodes = [model.global, ...model.connections].filter(Boolean);
    return nodes.find(node => secret.start >= node.start && secret.end <= node.end) || null;
  }

  function update(document, connection, changes) {
    const patches = [];
    for (const [field, value] of Object.entries(changes || {})) {
      const assignment = connection.fields[field];
      if (!assignment) throw new Error(`WireGuard-Feld ${field} ist in dieser Verbindung nicht vorhanden`);
      patches.push(document.patchAssignment(assignment, value));
    }
    return document.applyPatches(patches);
  }

  return { API_VERSION, project, findBySecret, update };
});
