import psycopg2

passwords = [
    'postgres', 'password', 'admin', 'root', '1234', '123456', 'liftiq', 'joel',
    'postgres123', 'Password123', 'Password123!', 'admin123', '12345678', 'joel123',
    'liftiq123', 'Postgres', 'Postgres123', 'Pg123456'
]
for p in passwords:
    try:
        conn = psycopg2.connect(f'postgresql://postgres:{p}@localhost:5432/postgres')
        print(f'Connected successfully with password: "{p}"')
        break
    except Exception as e:
        pass
else:
    print("None of the standard passwords matched.")

