import useAuth from '../../hooks/useAuth'

const AuthProvider = ({ children }) => {
  // checkAuth fires inside useAuth on mount
  useAuth()
  return children
}

export default AuthProvider