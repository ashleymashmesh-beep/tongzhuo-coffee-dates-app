import { useLocation, useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { path: '/', icon: '☕', label: '约咖' },
    { path: '/calendar', icon: '📅', label: '日历' },
    { path: '/profile', icon: '👤', label: '我的' }
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-[#E8D5BC] bg-[#FDFAF6]">
      <div className="flex">
        {navItems.map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex-1 flex flex-col items-center py-2 gap-1"
          >
            <span className="text-lg">{item.icon}</span>
            <span className={`text-[9px] tracking-wide ${
              location.pathname === item.path
                ? 'text-[#2C1A0E] font-semibold'
                : 'text-[#9A7A5C]'
            }`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
