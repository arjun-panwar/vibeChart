import React, { createContext, useContext, useEffect, useState } from 'react';
import { getConfig } from '../api';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Check localStorage or system preference
    const getInitialTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) return savedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const [theme, setTheme] = useState(getInitialTheme);

    // Fetch config on mount to override default if no user preference
    useEffect(() => {
        const fetchConfig = async () => {
            // If user has already manually set a preference, verify and keep it. 
            // Logic: If localStorage exists, we prioritize it. 
            if (localStorage.getItem('theme')) return;

            const config = await getConfig();
            if (config && config.defaultTheme) {
                setTheme(config.defaultTheme);
            }
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        // Update data-theme attribute on document root
        document.documentElement.setAttribute('data-theme', theme);
        // Persist to localStorage
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
