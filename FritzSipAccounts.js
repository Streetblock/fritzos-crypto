(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./FritzConfigDocument.js"));
  else root.FritzSipAccounts = factory(root.FritzConfigDocument);
})(typeof globalThis !== "undefined" ? globalThis : this, function (ConfigApi) {
  "use strict";

  const API_VERSION = "1";

  function project(document) {
    const section = document.getSection("voip.cfg");
    if (!section) return [];
    return document.getBlocks(section, block => /^ua\d*$/i.test(block.name)).map((block, index) => {
      const assignments = document.getAssignments(block);
      const fields = Object.create(null);
      assignments.forEach(assignment => { fields[assignment.name] = assignment; });
      return {
        id: `sip-block-${block.name.toLowerCase()}-${index + 1}`,
        blockId: block.id,
        block,
        name: block.name,
        line: block.line,
        start: block.start,
        end: block.end,
        fields,
        values: Object.fromEntries(assignments.map(assignment => [assignment.name, assignment.value]))
      };
    });
  }

  function findBySecret(accounts, secret) {
    return accounts.find(account => secret.start >= account.start && secret.end <= account.end) || null;
  }

  function update(document, account, changes) {
    const patches = [];
    for (const [field, value] of Object.entries(changes || {})) {
      const assignment = account.fields[field];
      if (!assignment) throw new Error(`SIP-Feld ${field} ist in ${account.name} nicht vorhanden`);
      patches.push(document.patchAssignment(assignment, value));
    }
    return document.applyPatches(patches);
  }

  function clone(document, account, draftChanges) {
    const accounts = project(document);
    const used = new Set(accounts.map(item => item.name.toLowerCase()));
    let ordinal = 1;
    while (used.has(`ua${ordinal}`)) ordinal += 1;
    const nextName = `ua${ordinal}`;
    const raw = document.source.slice(account.start, account.end);
    const renamed = raw.slice(0, account.block.nameStart - account.start) + nextName +
      raw.slice(account.block.nameEnd - account.start);
    const eol = document.source.includes("\r\n") ? "\r\n" : "\n";
    let updatedText = document.applyPatches([{ start: account.end, end: account.end, text: eol + renamed }]);
    if (draftChanges && Object.keys(draftChanges).length > 0) {
      const updatedDocument = ConfigApi.parse(updatedText);
      const created = project(updatedDocument).find(item => item.name.toLowerCase() === nextName);
      updatedText = update(updatedDocument, created, Object.fromEntries(
        Object.entries(draftChanges).filter(([field]) => created.fields[field])
      ));
    }
    return { updatedText, accountName: nextName };
  }

  return { API_VERSION, project, findBySecret, update, clone };
});
