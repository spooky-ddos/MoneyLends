import React, { useState } from 'react';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { TextField, Button, Paper, Typography, Box } from '@mui/material';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useSnackbar } from '../contexts/SnackbarContext';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      showSnackbar('Hasła nie są identyczne', 'error');
      return;
    }

    if (password.length < 6) {
      showSnackbar('Hasło powinno mieć co najmniej 6 znaków', 'error');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      showSnackbar('Konto zostało utworzone pomyślnie', 'success');
      navigate('/');
    } catch (error) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          showSnackbar('Ten adres email jest już zajęty', 'error');
          break;
        case 'auth/invalid-email':
          showSnackbar('Nieprawidłowy adres email', 'error');
          break;
        case 'auth/operation-not-allowed':
          showSnackbar('Rejestracja jest obecnie niedostępna', 'error');
          break;
        default:
          showSnackbar('Wystąpił błąd podczas rejestracji', 'error');
      }
    }
  };

  return (
    <Box 
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{ 
        maxWidth: '600px',
        width: { xs: '95%', sm: '100%' },
        margin: '2rem auto',
        padding: { xs: '0.5rem', sm: '2rem' }
      }}
    >
      <Paper elevation={3} sx={{ 
        padding: '2rem',
        backgroundColor: 'rgba(255,255,255,0.9)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button
            component={Link}
            to="/login"
            variant="outlined"
            startIcon={<ArrowBackIcon />}
          >
            Powrót
          </Button>
          <Typography variant="h5">
            Rejestracja
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="Hasło"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            sx={{ mb: 3 }}
          />
          
          <TextField
            label="Powtórz hasło"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            fullWidth
            sx={{ mb: 3 }}
          />
          
          <Button 
            type="submit"
            variant="contained"
            fullWidth
            sx={{ 
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.02)'
              }
            }}
          >
            Zarejestruj się
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default Register; 