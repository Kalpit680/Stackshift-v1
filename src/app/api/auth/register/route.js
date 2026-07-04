import { NextResponse } from 'next/server';
import { readUsersDB, writeUsersDB } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields (name, email, password) are required.' }, { status: 400 });
    }

    const users = readUsersDB();
    const isDuplicate = users.some((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (isDuplicate) {
      return NextResponse.json(
        { error: 'An account with this email is already registered. Please sign in instead.' },
        { status: 400 }
      );
    }

    const newUser = {
      name,
      email: email.toLowerCase(),
      password
    };

    users.push(newUser);
    writeUsersDB(users);

    return NextResponse.json({ success: true, message: 'User registered successfully!' }, { status: 201 });
  } catch (error) {
    console.error('Error during registration API execution:', error);
    return NextResponse.json({ error: 'Failed to register new user.' }, { status: 500 });
  }
}
