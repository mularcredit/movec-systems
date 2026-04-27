import os

filepath = '/Users/mac/Desktop/ISP BILLING/frontend/src/App.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Comment out the session check block that returns the public router
content = content.replace('if (!session) {', 'if (false) {')

with open(filepath, 'w') as f:
    f.write(content)

print("Auth bypassed.")
