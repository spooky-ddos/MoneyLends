import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Button, IconButton, Typography, Box, Container, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { ExitToApp as LogoutIcon, Brightness4, Brightness7, Menu as MenuIcon, Home as HomeIcon, BarChart as BarChartIcon, PersonAdd as PersonAddIcon, GroupAdd as GroupAddIcon } from '@mui/icons-material';
import { AuthContext } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import GroupPayment from './GroupPayment';

function Navigation() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { darkMode, setDarkMode } = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [openGroupPayment, setOpenGroupPayment] = useState(false);
  const location = useLocation();

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Błąd podczas wylogowywania:', error);
    }
  };

  const handleGroupPaymentSuccess = () => {
    if (location.pathname === '/') {
      window.location.reload();
    }
  };

  return (
    <AppBar position="static" sx={{ 
      backgroundColor: 'var(--paper-background)', 
      boxShadow: 'var(--box-shadow)' 
    }}>
      <Container maxWidth="lg">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography 
            variant="h6" 
            component={Link} 
            to="/" 
            sx={{ 
              color: 'var(--primary-color)', 
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            MoneyLends
          </Typography>
          
          {user && (
            <>
              {/* Menu na większe ekrany */}
              <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2, alignItems: 'center' }}>
                <Button 
                  component={Link} 
                  to="/" 
                  sx={{ color: 'var(--text-color)' }}
                >
                  Główna
                </Button>
                <Button 
                  component={Link} 
                  to="/statystyki" 
                  sx={{ color: 'var(--text-color)' }}
                >
                  Statystyki
                </Button>
                <Button 
                  component={Link} 
                  to="/dodaj-osobe" 
                  variant="contained"
                  sx={{ 
                    backgroundColor: 'var(--primary-color)',
                    '&:hover': {
                      backgroundColor: 'var(--secondary-color)'
                    }
                  }}
                >
                  Dodaj Nową Osobę
                </Button>
                <Button 
                  onClick={() => setOpenGroupPayment(true)}
                  variant="contained"
                  sx={{ 
                    bgcolor: 'primary.main',
                    color: '#fff',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    ml: 2
                  }}
                >
                  Grupowa Płatność
                </Button>
                <IconButton 
                  onClick={() => setDarkMode(!darkMode)} 
                  sx={{ color: 'var(--text-color)' }}
                >
                  {darkMode ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
                <IconButton
                  onClick={handleLogout}
                  sx={{ color: 'var(--text-color)' }}
                >
                  <LogoutIcon />
                </IconButton>
              </Box>

              {/* Menu mobilne */}
              <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, alignItems: 'center' }}>
                <IconButton 
                  onClick={() => setDarkMode(!darkMode)} 
                  sx={{ color: 'var(--text-color)' }}
                >
                  {darkMode ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
                <IconButton
                  onClick={handleMenu}
                  sx={{ color: 'var(--text-color)' }}
                >
                  <MenuIcon />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  PaperProps={{
                    sx: {
                      width: '100%',
                      maxWidth: '100%',
                      left: '0 !important',
                      right: '0',
                      top: '64px !important',
                      backgroundColor: 'var(--paper-background)',
                      color: 'var(--text-color)',
                      boxShadow: 'var(--box-shadow)'
                    }
                  }}
                >
                  <MenuItem 
                    component={Link} 
                    to="/" 
                    onClick={handleClose}
                    sx={{ 
                      display: 'flex',
                      gap: 3,
                      pl: 3,
                      py: 2
                    }}
                  >
                    <HomeIcon sx={{ color: 'primary.main' }} />
                    <span>Główna</span>
                  </MenuItem>
                  <MenuItem 
                    component={Link} 
                    to="/statystyki" 
                    onClick={handleClose}
                    sx={{ 
                      display: 'flex',
                      gap: 3,
                      pl: 3,
                      py: 2
                    }}
                  >
                    <BarChartIcon sx={{ color: 'primary.main' }} />
                    <span>Statystyki</span>
                  </MenuItem>
                  <MenuItem 
                    component={Link} 
                    to="/dodaj-osobe" 
                    onClick={handleClose}
                    sx={{ 
                      display: 'flex',
                      gap: 3,
                      pl: 3,
                      py: 2
                    }}
                  >
                    <PersonAddIcon sx={{ color: 'primary.main' }} />
                    <span>Dodaj Nową Osobę</span>
                  </MenuItem>
                  <MenuItem onClick={() => {
                    setOpenGroupPayment(true);
                    handleClose();
                  }}
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    pl: 3,
                    py: 2
                  }}
                  >
                    <GroupAddIcon sx={{ color: 'primary.main' }} />
                    <span>Grupowa Płatność</span>
                  </MenuItem>
                  <MenuItem 
                    onClick={() => { handleLogout(); handleClose(); }}
                    sx={{ 
                      py: 2,
                      justifyContent: 'center',
                      color: 'error.main',
                      '&:hover': {
                        backgroundColor: 'error.light',
                        opacity: 0.9
                      }
                    }}
                  >
                    <LogoutIcon sx={{ mr: 1 }} />
                    Wyloguj
                  </MenuItem>
                </Menu>
              </Box>
            </>
          )}
        </Toolbar>
      </Container>
      <GroupPayment 
        open={openGroupPayment} 
        onClose={() => setOpenGroupPayment(false)}
        onSuccess={handleGroupPaymentSuccess}
      />
    </AppBar>
  );
}

export default Navigation; 