# ponytail: install the published package instead of building from source — Glama only needs
# the stdio server to start and answer introspection. Switch to a source build if you ever
# need the image to reflect un-published local changes.
FROM node:22-alpine
RUN npm install -g @marvelcodes/mcp-pear@latest
# Public tools work with no auth, so introspection (tools/list) succeeds without env vars.
ENTRYPOINT ["mcp-pear"]
