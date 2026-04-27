import os
import re

mappings = {
    'Activity': 'IconActivity', 'AlertCircle': 'IconAlertCircle', 'AlertTriangle': 'IconAlertTriangle',
    'Archive': 'IconArchive', 'ArrowDown': 'IconArrowDown', 'ArrowDownLeft': 'IconArrowDownLeft',
    'ArrowDownRight': 'IconArrowDownRight', 'ArrowLeft': 'IconArrowLeft', 'ArrowRight': 'IconArrowRight',
    'ArrowUp': 'IconArrowUp', 'ArrowUpRight': 'IconArrowUpRight', 'BarChart2': 'IconChartBar',
    'BarChart3': 'IconChartBar', 'Bell': 'IconBell', 'BellRing': 'IconBellRinging', 'Bookmark': 'IconBookmark',
    'Box': 'IconBox', 'Building': 'IconBuilding', 'Building2': 'IconBuildingCommunity', 'Calendar': 'IconCalendar',
    'CalendarClock': 'IconCalendarTime', 'Check': 'IconCheck', 'CheckCircle2': 'IconCircleCheck',
    'ChevronDown': 'IconChevronDown', 'ChevronRight': 'IconChevronRight', 'Clock': 'IconClock',
    'Copy': 'IconCopy', 'Cpu': 'IconCpu', 'CreditCard': 'IconCreditCard', 'Crown': 'IconCrown',
    'DollarSign': 'IconCurrencyDollar', 'Download': 'IconDownload', 'Edit2': 'IconEdit', 'Edit3': 'IconEdit',
    'Eye': 'IconEye', 'EyeOff': 'IconEyeOff', 'FileText': 'IconFileText', 'Filter': 'IconFilter',
    'Fingerprint': 'IconFingerprint', 'Gauge': 'IconGauge', 'Globe': 'IconGlobe', 'HardDrive': 'IconDatabase',
    'Hash': 'IconHash', 'HelpCircle': 'IconHelpCircle', 'History': 'IconHistory', 'Info': 'IconInfoCircle',
    'Key': 'IconKey', 'LayoutDashboard': 'IconLayoutDashboard', 'LayoutTemplate': 'IconLayoutBoard',
    'Loader2': 'IconLoader2', 'Lock': 'IconLock', 'LogOut': 'IconLogout', 'Mail': 'IconMail',
    'MapPin': 'IconMapPin', 'Menu': 'IconMenu2', 'MessageCircle': 'IconMessageCircle',
    'MessageSquare': 'IconMessage', 'MoreHorizontal': 'IconDots', 'MoreVertical': 'IconDotsVertical',
    'Network': 'IconNetwork', 'Package': 'IconPackage', 'PaintBucket': 'IconPaint', 'Pause': 'IconPlayerPause',
    'Phone': 'IconPhone', 'Play': 'IconPlayerPlay', 'Plus': 'IconPlus', 'Radar': 'IconRadar',
    'Radio': 'IconRouter', 'Receipt': 'IconReceipt', 'RefreshCw': 'IconRefresh', 'Router': 'IconRouter',
    'RouterIcon': 'IconRouter', 'Save': 'IconDeviceFloppy', 'Search': 'IconSearch', 'Send': 'IconSend',
    'Server': 'IconServer', 'Settings': 'IconSettings', 'SettingsIcon': 'IconSettings', 'Share2': 'IconShare',
    'Shield': 'IconShield', 'ShieldAlert': 'IconShieldX', 'ShieldCheck': 'IconShieldCheck',
    'Signal': 'IconAntenna', 'Smartphone': 'IconDeviceMobile', 'Star': 'IconStar', 'Tag': 'IconTag',
    'Terminal': 'IconTerminal2', 'Thermometer': 'IconTemperature', 'Trash2': 'IconTrash',
    'TrendingUp': 'IconTrendingUp', 'User': 'IconUser', 'UserCheck': 'IconUserCheck', 'UserCircle': 'IconUserCircle',
    'UserPlus': 'IconUserPlus', 'UserX': 'IconUserX', 'Users': 'IconUsers', 'WalletCards': 'IconWallet',
    'Wifi': 'IconWifi', 'WifiOff': 'IconWifiOff', 'X': 'IconX', 'XCircle': 'IconCircleX',
    'XOctagon': 'IconCircleX', 'Zap': 'IconBolt'
}

base_dir = '/Users/mac/Desktop/ISP BILLING/frontend/src'

for root, _, files in os.walk(base_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
            
            # Find lucide-react imports
            match = re.search(r"import\s+\{([^}]+)\}\s+from\s+['\"]lucide-react['\"]", content)
            if not match:
                continue
                
            original_import_block = match.group(0)
            icons_str = match.group(1)
            icons = [i.strip() for i in icons_str.replace('\n', '').split(',') if i.strip()]
            
            tabler_imports = set()
            for icon in icons:
                alias = None
                if ' as ' in icon:
                    parts = icon.split(' as ')
                    icon_name = parts[0].strip()
                    alias = parts[1].strip()
                else:
                    icon_name = icon
                
                target_name = alias if alias else icon_name
                tabler_name = mappings.get(icon_name, 'IconHelp')
                tabler_imports.add(tabler_name)
                
                # STRICT REPLACEMENTS TO AVOID TEXT MANGLING
                # JSX: <TargetName
                content = re.sub(rf"<{target_name}\b", f"<{tabler_name}", content)
                # Object props: icon: TargetName
                content = re.sub(rf"\bicon:\s*{target_name}\b", f"icon: {tabler_name}", content)
                content = re.sub(rf"\bIcon:\s*{target_name}\b", f"Icon: {tabler_name}", content)
                # JSX props: icon={TargetName}
                content = re.sub(rf"\bicon=\{{\s*{target_name}\s*\}}", f"icon={{{tabler_name}}}", content)
                # Array elements (if any just standalone)
                # Avoid global \bTargetName\b
                
            # Replace the import statement completely safely
            new_import_stmt = "import { " + ", ".join(sorted(tabler_imports)) + " } from '@tabler/icons-react';"
            content = content.replace(original_import_block, new_import_stmt)
            
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"Safely Migrated {filepath}")

