import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TextField, Button, Paper, Typography, Box, Alert } from '@mui/material';
import { AuthContext } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import styles from './Login.module.css';
import { motion } from 'framer-motion';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      console.error('Błąd logowania:', err);
      switch (err.code) {
        case 'auth/configuration-not-found':
          setError('Błąd konfiguracji Firebase. Skontaktuj się z administratorem.');
          break;
        case 'auth/invalid-email':
          setError('Nieprawidłowy adres email.');
          break;
        case 'auth/user-disabled':
          setError('To konto zostało wyłączone.');
          break;
        case 'auth/user-not-found':
          setError('Nie znaleziono użytkownika o podanym adresie email.');
          break;
        case 'auth/wrong-password':
          setError('Nieprawidłowe hasło.');
          break;
        default:
          setError('Wystąpił błąd podczas logowania. Spróbuj ponownie.');
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
        <Typography 
          variant="h5" 
          sx={{ mb: 3 }}
        >
          Logowanie
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
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
            Zaloguj się
          </Button>

          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
            Nie masz jeszcze konta?{' '}
            <Link 
              to="/register" 
              style={{ 
                color: 'var(--primary-color)',
                textDecoration: 'none'
              }}
            >
              Zarejestruj się
            </Link>
          </Typography>
        </form>
      </Paper>
    </Box>
  );
}

export default Login; 