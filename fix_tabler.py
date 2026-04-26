import re

def fix_file(filepath, mappings):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace the remaining references that aren't inside < >
    for old_tag, new_tag in mappings.items():
        # Match word boundaries so we don't accidentally replace parts of words
        content = re.sub(rf"\b{old_tag}\b", new_tag, content)
        
    # Fix the missing IconRam issue
    content = content.replace('IconRam', 'IconDeviceSdCard')
        
    with open(filepath, 'w') as f:
        f.write(content)

mappings_router = {
    'Cpu': 'IconCpu',
    'MemoryStick': 'IconDeviceSdCard',
    'Activity': 'IconActivity',
    'Wifi': 'IconWifi',
    'RefreshCw': 'IconRefresh',
    'AlertTriangle': 'IconAlertTriangle',
    'CheckCircle': 'IconCircleCheck',
    'XCircle': 'IconCircleX',
    'ArrowUpRight': 'IconArrowUpRight',
    'ArrowDownLeft': 'IconArrowDownLeft',
    'Radio': 'IconRouter',
    'Server': 'IconServer',
    'Clock': 'IconClock'
}

mappings_dash = {
    'Users': 'IconUsers',
    'UserX': 'IconUserX',
    'AlertTriangle': 'IconAlertTriangle',
    'Clock': 'IconClock',
    'Server': 'IconServer',
    'CheckCircle2': 'IconCircleCheck',
    'CreditCard': 'IconCreditCard',
    'Wallet': 'IconWallet',
    'Activity': 'IconActivity',
    'Zap': 'IconBolt',
    'ArrowUpRight': 'IconArrowUpRight',
    'Signal': 'IconAntenna'
}

fix_file('/Users/mac/Desktop/ISP BILLING/frontend/src/pages/Network/RouterStats/RouterStats.tsx', mappings_router)
fix_file('/Users/mac/Desktop/ISP BILLING/frontend/src/pages/Dashboard.tsx', mappings_dash)

print("Fixed variable references.")
