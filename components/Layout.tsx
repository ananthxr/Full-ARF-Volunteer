// Layout component for the volunteer page
import React from 'react';
import Head from 'next/head';

interface LayoutProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export default function Layout({
  title = 'AR Treasure Hunt - Volunteer Dashboard',
  description = 'Volunteer dashboard for managing AR Treasure Hunt scores',
  children
}: LayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        {children}
      </div>
    </>
  );
}