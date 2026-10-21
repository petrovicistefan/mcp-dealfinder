Output docs/demo.gif

Set FontSize 14
Set Width 1400
Set Height 700
Set Theme "Catppuccin Mocha"
Set Padding 20

Hide
Type "cd mcp-dealfinder"
Enter
Sleep 500ms
Show

Type "# MCP DealFinder - Turn affiliate feeds into AI shopping answers"
Sleep 1s
Enter
Sleep 300ms

Type "# Step 1: Validate feeds and check tracked links"
Sleep 800ms
Enter
Sleep 300ms

Type "npm run check"
Sleep 500ms
Enter
Sleep 3s

Type "# Step 2: Search products (demo mode - no config needed)"
Sleep 800ms
Enter
Sleep 300ms

Type@50ms 'echo ''{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_products","arguments":{"query":"headphones","max_price":150,"limit":3,"sort":"price_asc"}}}'' | npx -y mcp-dealfinder'
Sleep 500ms
Enter
Sleep 4s

Type "# ✓ Tracked affiliate links with your IDs"
Sleep 1s
Enter

Type "# ✓ Works with Cursor, Claude, VS Code, and any MCP client"
Sleep 1.5s
Enter

Sleep 2s
