import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
} from '@mui/material';
import { auth } from '../firebase';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useSnackbar } from '../contexts/SnackbarContext';

function Settings({ open, onClose }) {
  const { showSnackbar } = useSnackbar();
  
  const [language, setLanguage] = useState('pl');
  const [currency, setCurrency] = useState('PLN');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [password, setPassword] = useState('');
  const [deleteAccountMode, setDeleteAccountMode] = useState(false);
  const [changePasswordMode, setChangePasswordMode] = useState(false);

  const handleChangePassword = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      setChangePasswordMode(false);
      setCurrentPassword('');
      setNewPassword('');
      showSnackbar('Hasło zostało zmienione pomyślnie');
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        showSnackbar('Aktualne hasło jest nieprawidłowe', 'error');
      } else if (error.code === 'auth/weak-password') {
        showSnackbar('Nowe hasło jest za słabe. Powinno mieć co najmniej 6 znaków', 'error');
      } else {
        showSnackbar('Wystąpił błąd podczas zmiany hasła', 'error');
      }
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;

      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await deleteUser(user);
      onClose();
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        showSnackbar('Podane hasło jest nieprawidłowe', 'error');
      } else {
        showSnackbar('Wystąpił błąd podczas usuwania konta', 'error');
      }
    }
  };

  const handleSaveSettings = () => {
    showSnackbar('Ustawienia zostały zapisane pomyślnie');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Ustawienia</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel 
              sx={{ 
                '&.MuiInputLabel-shrink': { 
                  bgcolor: 'white',
                  padding: '0 8px',
                }
              }}
            >
              Język
            </InputLabel>
            <Select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                borderRadius: '0.5rem'
              }}
            >
              <MenuItem value="pl">Polski</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="de">Deutsch</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel 
              sx={{ 
                '&.MuiInputLabel-shrink': { 
                  bgcolor: 'white',
                  padding: '0 8px',
                }
              }}
            >
              Waluta
            </InputLabel>
            <Select 
              value={currency} 
              onChange={(e) => setCurrency(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0'
                },
                borderRadius: '0.5rem'
              }}
            >
              <MenuItem value="PLN">Polski Złoty (PLN)</MenuItem>
              <MenuItem value="EUR">Euro (EUR)</MenuItem>
              <MenuItem value="USD">US Dollar (USD)</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 4, mb: 2, display: 'flex', gap: 2 }}>
            {!changePasswordMode ? (
              <>
                <Button 
                  variant="outlined"
                  onClick={() => setChangePasswordMode(true)}
                >
                  Zmień hasło
                </Button>
                <Button 
                  color="error" 
                  variant="outlined"
                  onClick={() => setDeleteAccountMode(true)}
                >
                  Usuń konto
                </Button>
              </>
            ) : (
              <Box sx={{ width: '100%' }}>
                <TextField
                  type="password"
                  label="Aktualne hasło"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  type="password"
                  label="Nowe hasło"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    variant="contained"
                    onClick={handleChangePassword}
                  >
                    Zapisz nowe hasło
                  </Button>
                  <Button 
                    onClick={() => {
                      setChangePasswordMode(false);
                      setCurrentPassword('');
                      setNewPassword('');
                    }}
                  >
                    Anuluj
                  </Button>
                </Box>
              </Box>
            )}
          </Box>

          {deleteAccountMode && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="error" gutterBottom>
                Ta operacja jest nieodwracalna. Wszystkie Twoje dane zostaną usunięte.
              </Typography>
              <TextField
                type="password"
                label="Potwierdź hasło"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                sx={{ mt: 2, mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  color="error" 
                  variant="contained"
                  onClick={handleDeleteAccount}
                >
                  Potwierdzam usunięcie konta
                </Button>
                <Button 
                  onClick={() => {
                    setDeleteAccountMode(false);
                    setPassword('');
                  }}
                >
                  Anuluj
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Anuluj</Button>
        <Button 
          variant="contained" 
          onClick={handleSaveSettings}
        >
          Zapisz zmiany
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default Settings;
